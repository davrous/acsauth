# Azure Communication Services Quick Starter

[Azure Communication Services (ACS)](https://azure.microsoft.com/en-us/services/communication-services) is a set of rich communication APIs, video APIs, and SMS APIs for deploying your applications across any device, on any platform. If you’re looking on enabling chat, audio/video conferencing, phone calls or SMS inside an existing app, you should have a look to this service. 

This repo is used as a starter for a _very basic_ HTML web application using no front-end frameworks. It shows how to map an identity provided by a [Static Web App](https://docs.microsoft.com/en-us/azure/static-web-apps/overview) (Github, Microsoft, Twitter or Google) to an ACS identity. You can then deploy this sample is a couple of minutes following the instructions below and share the URL to the web app to do calls to another user using ACS or to join a Microsoft Teams meeting like described in this video: 

[![Watch the video](https://img.youtube.com/vi/Jbf50SL1ceI/0.jpg)](https://youtu.be/Jbf50SL1ceI)

This repo also contains a more advanced Metaverse demo allowing to call someone in Teams from a VR environment running in the browser like demonstrated in this short video: 

[![Watch the video](https://img.youtube.com/vi/Wd4qNeLV_P8/0.jpg)](https://youtu.be/Wd4qNeLV_P8)

## How to deploy the sample in minutes

### Step 1 - copy this repo in your Github repositories

First, you need to be logged in on Github and then press on the green "**use this template**" button:

![Use This Template Button](./images/acsquicktesttemplatebutton.jpg)

Then fill the required properties, be sure to make it public and press "**Create repository from template**" button:

![Creating the repo from the template](./images/acsquicktesttemplatebutton002.jpg)

### Step 2 - provision all required resources using the Deploy To Azure button

This will copy this repo into your Github account. Simply click on the "**Deploy To Azure**" button below:

[![Deploy To Azure](https://raw.githubusercontent.com/Azure/azure-quickstart-templates/master/1-CONTRIBUTION-GUIDE/images/deploytoazure.svg?sanitize=true)](https://portal.azure.com/#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2Fdavrous%2Facsauth%2Fmain%2Finfra%2Fazuredeploy.json)

In the various regions you'll choose, this will create a dedicated ressource group (named rg-*yourname*) and will automatically deploy inside it:

- an Azure Communication Services ressource
- a CosmosDB 
- a Static Web App

### Step 3 - Grab the Static Web App deployment token from the Azure Portal

Once completed, you'll have a similar screen indicating your deployment is complete:

![Template deployment completed screen](./images/acsquicktesttemplatebutton004.jpg)

We're almost done! We now need to associate your Github repo with the freshly provisionned Azure Static Web App. For that, open the new resource group just created by clicking on it. It should be named "rg-*yourname*" like in the above screenshot. You'll then see the 3 resources created inside this resource group:

![3 resources created: a Communication Service, a Cosmos DB & a Static Web App](./images/acsquicktesttemplatebutton005.jpg)

Click on the Static Web App named "sttapp-*yourname*" then click on the "**Manage deployment token**" button and copy to the clipboard the secret token.

![Azure SWA deployment token screen](./images/acsquicktesttemplatebutton006.jpg)

### Step 4 - Copy the SWA deployment token as a secret in your Github repo

Now to be able to run your GitHub Actions workflow to deploy the ACS sample demonstrated in the videos, you need to store the SWA deployment token in a secret value named `AZURE_STATIC_WEB_APPS_API_TOKEN`. For that, go into the **Settings** of your Github repo and then navigate to the Secrets->Actions section to create a new secret key.

![Github secret key for SWA deployment](./images/acsquicktesttemplatebutton007.jpg)

### Step 5 - Run the Github Actions deployment workflow
