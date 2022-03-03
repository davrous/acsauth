param name string
param cosdbaLocation string = resourceGroup().location

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

param cosdbaPrimaryRegion string = 'West US 2'

@allowed([
    'EnableCassandra'
    'EnableGremlin'
    'EnableServerless'
    'EnableTable'
])
param cosdbaCapability string = 'EnableServerless'

@allowed([
    'Local'
    'Zone'
    'Geo'
])
param cosdbaBackupStorageRedundancy string = 'Local'

var cosmosDb = {
    name: 'cosdba-${name}'
    location: cosdbaLocation
    databaseAccountOfferType: cosdbaAccountOfferType
    enableAutomaticFailover: cosdbaAutomaticFailover
    defaultConsistencyLevel: cosdbaConsistencyLevel
    primaryRegion: cosdbaPrimaryRegion
    capability: cosdbaCapability
    backupStorageRedundancy: cosdbaBackupStorageRedundancy
}

resource cosdba 'Microsoft.DocumentDB/databaseAccounts@2021-10-15' = {
    name: cosmosDb.name
    location: cosmosDb.location
    kind: 'GlobalDocumentDB'
    properties: {
        databaseAccountOfferType: cosmosDb.databaseAccountOfferType
        enableAutomaticFailover: cosmosDb.enableAutomaticFailover
        consistencyPolicy: {
            defaultConsistencyLevel: cosmosDb.defaultConsistencyLevel
            maxIntervalInSeconds: 5
            maxStalenessPrefix: 100
        }
        locations: [
            {
                locationName: cosmosDb.primaryRegion
                failoverPriority: 0
                isZoneRedundant: false
            }
        ]
        capabilities: [
            {
                name: cosmosDb.capability
            }
        ]
        backupPolicy: {
            type: 'Periodic'
            periodicModeProperties: {
                backupIntervalInMinutes: 240
                backupRetentionIntervalInHours: 8
                backupStorageRedundancy: cosmosDb.backupStorageRedundancy
            }
        }
    }
}

output id string = cosdba.id
output name string = cosdba.name
output connectionString string = 'AccountEndpoint=https://${cosdba.name}.documents.azure.com:443/;AccountKey=${cosdba.listKeys().primaryMasterKey};'
