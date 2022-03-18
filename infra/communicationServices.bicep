param name string

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
param acsvcDataLocation string = 'United States'


var commService = {
  name: 'acsvc-${name}'
  location: 'global'
  dataLocation: acsvcDataLocation
}

resource acs 'Microsoft.Communication/communicationServices@2020-08-20' = {
  name: commService.name
  location: commService.location
  properties: {
    dataLocation: commService.dataLocation
  }
}

output id string = acs.id
output name string = acs.name
output connectionString string = acs.listKeys().primaryConnectionString
