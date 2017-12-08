const fetch = require('isomorphic-fetch');

module.exports = (ctx, cb) => {
    // TIPS:
    // 1. Input and output: https://github.com/auth0/slash#inputs-and-outputs
    // 2. Response formatting: https://api.slack.com/docs/messages/builder
    // 3. Secrets you configure using the key icon are available on `ctx.secrets`

    const host = "http://ec2-107-20-208-73.compute-1.amazonaws.com:8085";

    const projectsUrl = `${host}/rest/api/latest/project?os_authType=basic&expand=projects.project.plans.plan.branches`;

    const username = ctx.data['bamboo-username'];
    const password = ctx.data['bamboo-password'];
    const auth = "Basic " + new Buffer(username + ":" + password).toString("base64");

    const headers = {
        Authorization: auth,
        Accept: 'application/json'
    };

    fetch(projectsUrl, {
            headers
        })
        .then(response => response.json())
        .then(object => Promise.all(object.projects.project.filter(project => ["FT", "TOOL"].indexOf(project.key) !== -1).map(resolveProject)))
        .then(generateResponse)
        .then(result => {
            cb(null, {
                response_type: 'in_channel',
                text: result.text,
                attachments: result.attachments
            });
        })
        .catch(err => {
            cb(null, {
                text: "Error: " + err.message
            });
        });

    function generateResponse(projects) {
        return {
            text: "Studio Build",
            attachments: projects.reduce((array, project) =>
                array.concat(
                    [{
                        title: project.name,
                        text: "Project",
                        title_link: `${host}/browse/${project.key}`
                    }].concat(project.plans.reduce((array2, plan) =>
                        array2.concat([generatePlanResponse(plan.master)].concat(plan.branches.map(generatePlanResponse))) //
                        , []))) //
                , [])
        };
    }

    function generatePlanResponse(plan) {
        const prefix = plan.isMaster ? "-- " : "\\---- ";
        return {
            title: prefix + plan.name,
            text: plan.isMaster ? "Plan" : "Branch",
            title_link: `${host}/browse/${plan.key}/latest`,
            color: plan.state == "Successful" ? '#1b6' : '#d34'
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
                name: result.plan ? result.plan.shortName : "saraza",
                key: key,
                lifeCycleState: result.lifeCycleState
            }));
        // result.lifeCycleState === "Finished"
    }

}