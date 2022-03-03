# Vanilla JavaScript App


[Azure Static Web Apps](https://docs.microsoft.com/azure/static-web-apps/overview) allows you to easily build JavaScript apps in minutes. Use this repo with the [quickstart](https://docs.microsoft.com/azure/static-web-apps/getting-started?tabs=vanilla-javascript) to build and customize a new static site.

This repo is used as a starter for a _very basic_ HTML web application using no front-end frameworks.


## Getting Started

### via Azure Portal

[![Deploy To Azure](https://raw.githubusercontent.com/Azure/azure-quickstart-templates/master/1-CONTRIBUTION-GUIDE/images/deploytoazure.svg?sanitize=true)](https://portal.azure.com/#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2Fdavrous%2Facstest%2Fmain%2Finfra%2Fmain.bicep)
[![Visualize](https://raw.githubusercontent.com/Azure/azure-quickstart-templates/master/1-CONTRIBUTION-GUIDE/images/visualizebutton.svg?sanitize=true)](http://armviz.io/#/?load=https%3A%2F%2Fraw.githubusercontent.com%2Fdavrous%2Facstest%2Fmain%2Finfra%2Fmain.bicep)


### via PowerShell

```powershell
$resourceName = "<resource_name>"
$location = "<cosmosdb_resource_location>"
$dataLocation = "<acs_data_location>"
$appLocation = "<static_app_location>"

./infra/Provision-Resources.ps1 `
    -ResourceName $resourceName `
    -Location $location `
    -CosmosDbPrimaryRegion $location `
    -CommunicationServiceDataLocation $dataLocation `
    -StaticWebAppLocation $appLocation `
    -TargetScope Subscription
```


### via Azure CLI

```bash
resourceName=<resource_name>
location=<cosmosdb_resource_location>
dataLocation=<acs_data_location>
appLocation=<static_app_location>

az deployment sub create \
    -l $location \
    -n Subscription \
    -f ./infra/main.bicep \
    -p name=$resourceName \
    -p location=$location \
    -p cosdbaPrimaryRegion=$location \
    -p acsvcDataLocation=$dataLocation \
    -p sttappLocation=$appLocation \
    --verbose
```


## TO-DO

* GitHub Actions workflow integration

