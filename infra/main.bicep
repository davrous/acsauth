param name string

// Cosmos DB
param cosdbaLocation string = resourceGroup().location
@allowed([
    'Standard'
])
param cosdbaAccountOfferType string = 'Standard'
param cosdbaAutomaticFailover bool = true
@allowed([
    'Strong'
    'BoundedStaleness'
    'Session'
    'ConsistentPrefix'
    'Eventual'
])
param cosdbaConsistencyLevel string = 'Session'
param cosdbaPrimaryRegion string = resourceGroup().location
param cosdbaEnableServerless bool = true
@allowed([
    'Local'
    'Zone'
    'Geo'
])
param cosdbaBackupStorageRedundancy string = 'Local'

// Azure Communication Services
@allowed([
    'Africa'
    'Asia Pacific'
    'Australia'
    'Brazil'
    'Canada'
    'Europe'
    'France'
    'Germany'
    'India'
    'Japan'
    'Korea'
    'United Kingdom'
    'United States'
])
param acsvcDataLocation string = 'Korea'

// Static Web App
@allowed([
    'centralus'
    'eastus2'
    'eastasia'
    'westeurope'
    'westus2'
])
param sttappLocation string = 'eastasia'

param sttappSkuName string = 'Free'
param sttappAllowConfigFileUpdates bool = true
@allowed([
    'Disabled'
    'Enabled'
])
param sttappStagingEnvironmentPolicy string = 'Enabled'

module cosdba './cosmosDb.bicep' = {
    name: 'CosmosDB'
    params: {
        name: name
        cosdbaLocation: cosdbaLocation
        cosdbaAccountOfferType: cosdbaAccountOfferType
        cosdbaAutomaticFailover: cosdbaAutomaticFailover
        cosdbaConsistencyLevel: cosdbaConsistencyLevel
        cosdbaPrimaryRegion: cosdbaPrimaryRegion
        cosdbaEnableServerless: cosdbaEnableServerless
        cosdbaBackupStorageRedundancy: cosdbaBackupStorageRedundancy
    }
}

module acsvc './communicationServices.bicep' = {
    name: 'CommunicationServices'
    params: {
        name: name
        acsvcDataLocation: acsvcDataLocation
    }
}

module sttapp './staticWebApp.bicep' = {
    name: 'StaticWebApp'
    params: {
        name: name
        sttappLocation: sttappLocation
        sttappSkuName: sttappSkuName
        sttappAllowConfigFileUpdates: sttappAllowConfigFileUpdates
        sttappStagingEnvironmentPolicy: sttappStagingEnvironmentPolicy
        acsvcConnectionString: acsvc.outputs.connectionString
        cosdbaConnectionString: cosdba.outputs.connectionString
    }
}

output cosdbaConnectionString string = cosdba.outputs.connectionString
output acsvcConnectionString string = acsvc.outputs.connectionString
output sttappDeploymentKey string = sttapp.outputs.deploymentKey
