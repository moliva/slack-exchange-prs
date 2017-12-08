const fetch = require('isomorphic-fetch');

module.exports = (ctx, cb) => {
    // TIPS:
    // 1. Input and output: https://github.com/auth0/slash#inputs-and-outputs
    // 2. Response formatting: https://api.slack.com/docs/messages/builder
    // 3. Secrets you configure using the key icon are available on `ctx.secrets`

    const host = "http://ec2-107-20-208-73.compute-1.amazonaws.com:8085";

    const projectsUrl = `${host}/rest/api/latest/project?os_authType=basic&expand=projects.project.plans.plan.branches`;

    // params
    const ONLY_ERROR = 'error';
    const SET = 'set';
    const ALL = 'all';

    const sets = {
        default: ["FT", "TOOL"],
        func: ["TTS", "TTL"]
    }

    const username = ctx.data['bamboo-username'];
    const password = ctx.data['bamboo-password'];
    const auth = "Basic " + new Buffer(username + ":" + password).toString("base64");

    const headers = {
        Authorization: auth,
        Accept: 'application/json'
    };

    const params = {};
    ctx.body.text.split(" ").filter(string => string !== "").map(property => property.split("=")).forEach(element => params[element[0]] = element[1] ? element[1] : "true");

    fetch(projectsUrl, {
            headers
        })
        .then(response => response.json())
        .then(object => object.projects.project)
        .then(applyPreFilters)
        .then(projects => Promise.all(projects.map(resolveProject)))
        .then(applyPostFilters)
        .then(generateResponse)
        .then(result => {
            cb(null, {
                response_type: 'in_channel',
                // text: result.text,
                attachments: result.attachments
            });
        })
        .catch(err => {
            cb(null, {
                text: "Error: " + err.message
            });
        });

    function applyPreFilters(projects) {
        if (params[ALL]) {
            return projects;
        }
        return projects.filter(project => sets[params[SET] ? params[SET] : 'default'].indexOf(project.key) !== -1);
    }

    function applyPostFilters(projects) {
        if (!params[ONLY_ERROR]) {
            return projects;
        }
        return projects.reduce((array, project) => array.concat(erroredOrEmpty(project)), []);
    }

    function erroredOrEmpty(project) {
        project.plans = project.plans.reduce((array, plan) =>
            array.concat(
                plan.master.isSuccessful() && plan.branches.filter(branch => !branch.isSuccessful()).length == 0 ? [] : {
                    master: plan.master,
                    branches: plan.branches.filter(branch => !branch.isSuccessful())
                }
            ), []);
        return project.plans.length == 0 ? [] : [project];
    }

    function generateResponse(projects) {
        return {
            // text: "Studio Build",
            attachments: projects.reduce((array, project) =>
                array //
                .concat(
                    [{
                        // pretext: project.name + " Project",
                        title: project.name,
                        thumb_url: "https://d2lp05f39ek59n.cloudfront.net/uploads/Atlassian_Bamboo_product_img_753498732_atlassian_charlie_square.png",
                        footer: "Project",
                        title_link: `${host}/browse/${project.key}`,
                        color: '#ffffff'
                    }]) //
                .concat(project.plans.reduce((array2, plan) =>
                        array2 //
                        .concat([generatePlanResponse(plan.master)]) //
                        .concat(plan.branches.slice(0, plan.branches.length - 1).map(branch => generatePlanResponse(branch, false))) //
                        .concat(plan.branches.length < 1 ? [] : [generatePlanResponse(plan.branches[plan.branches.length - 1], true)]) //
                        , []) //
                ) //
                , [])
        };
    }

    function generatePlanResponse(plan, isLast) {
        const prefix = plan.isMaster ? "" : (isLast ? "╚═ " : "╠═ ");
        return {
            title: prefix + plan.name,
            footer: (plan.isMaster ? "Plan" : "Branch") + " build number: " + plan.buildNumber,
            title_link: `${host}/browse/${plan.key}-${plan.buildNumber}`,
            color: plan.isFinished() ? (plan.isSuccessful() ? '#1b6' : '#d34') : '#eee'
        }
        // prColor = '#1b6';         verde
        // prColor = '#fb2';        amarillo
        // prColor = '#d34';            rojo
        // prColor = '#eee';        gris
    }

    function resolveProject(project) {
        return new Promise((resolve, reject) => {
            Promise.all(project.plans.plan.map(resolvePlan))
                .then(plans =>
                    ({
                        name: project.name,
                        key: project.key,
                        plans
                    }))
                .then(resolve)
                .catch(reject);
        });
    }

    function resolvePlan(plan) {
        return new Promise((resolve, reject) => {
            const master = fetchResult(plan, true);
            const branches = plan.branches.branch.map(branch => fetchResult(branch, false));
            Promise.all([master].concat(branches))
                .then(results =>
                    ({
                        master: results[0],
                        branches: results.slice(1)
                    }))
                .then(resolve)
                .catch(reject);
        });
    }

    function fetchResult(plan, isMaster) {
        const key = plan.key;
        const resultUrl = `${host}/rest/api/latest/result/${key}/latest?os_authType=basic`;

        return fetch(resultUrl, {
                headers
            })
            .then(response => response.json())
            .then(result => ({
                state: result.state,
                isMaster: isMaster ? true : false,
                buildNumber: result.buildNumber,
                name: result.plan ? result.plan.shortName : result.message,
                key: key,
                lifeCycleState: result.lifeCycleState,
                isSuccessful: () => result.state == "Successful",
                isFinished: () => result.lifeCycleState === "Finished"
            }));
    }

}