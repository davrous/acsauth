param name string

@allowed([
    'centralus'
    'eastus2'
    'eastasia'
    'westeurope'
    'westus2'
])
param sttappLocation string = 'eastasia'

@allowed([
    'Free'
    'Standard'
])
param sttappSkuName string = 'Free'

param sttappAllowConfigFileUpdates bool = true

@allowed([
    'Disabled'
    'Enabled'
])
param sttappStagingEnvironmentPolicy string = 'Enabled'

@secure()
param acsvcConnectionString string

@secure()
param cosdbaConnectionString string

var staticApp = {
    name: 'sttapp-${name}'
    location: sttappLocation
    skuName: sttappSkuName
    allowConfigFileUpdates: sttappAllowConfigFileUpdates
    stagingEnvironmentPolicy: sttappStagingEnvironmentPolicy
    connectionStrings: {
        acs: acsvcConnectionString
        cosmosDb: cosdbaConnectionString
    }
}

resource sttapp 'Microsoft.Web/staticSites@2021-03-01' = {
    name: staticApp.name
    location: staticApp.location
    sku: {
        name: staticApp.skuName
    }
    properties: {
        allowConfigFileUpdates: staticApp.allowConfigFileUpdates
        stagingEnvironmentPolicy: staticApp.stagingEnvironmentPolicy
    }
}

resource sttappconfig 'Microsoft.Web/staticSites/config@2021-03-01' = {
    name: '${sttapp.name}/appsettings'
    properties: {
        ACS_ConnectionString: staticApp.connectionStrings.acs
        MyAccount_COSMOSDB: staticApp.connectionStrings.cosmosDb
    }
}

output id string = sttapp.id
output name string = sttapp.name
output deploymentKey string = sttapp.listSecrets().properties.apiKey
