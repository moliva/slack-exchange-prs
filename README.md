# Slack Studio Web Tasks

## Studio PRs
Shows the status for all currently open PRs in Studio repositories, execute:
```
/wt studio-prs
```

## Studio Build
Get the status for Studio Bamboo plans and branches status, giving a quick access monitor to the build and a fast link to the web interface.
Basic command:
```
/wt studio-build
```
Apply set filter (e.g. `func` for functional tests, `default` for standard Fast Tests and Tooling projects):
```
/wt studio-build set=func
```
Apply an `all` fitler to view all build status:
```
/wt studio-build all
```
Or an error filter to only check the errored ones:
```
/wt studio-build error
```
Or a combination of them:
```
/wt studio-build all error
```
