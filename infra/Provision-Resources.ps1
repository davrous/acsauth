# Provisions resources based on Flags
Param(
    [string]
    [Parameter(Mandatory=$false)]
    $ResourceGroupName = "",

    [string]
    [Parameter(Mandatory=$false)]
    $ResourceName = "",

    [string]
    [Parameter(Mandatory=$false)]
    $Location = "koreacentral",

    ### Cosmos DB ###
    [string]
    [Parameter(Mandatory=$false)]
    $CosmosDbAccountOfferType = "Standard",

    [bool]
    [Parameter(Mandatory=$false)]
    $CosmosDbAutomaticFailover = $true,

    [string]
    [Parameter(Mandatory=$false)]
    [ValidateSet("Strong", "BoundedStaleness", "Session", "ConsistentPrefix", "Eventual")]
    $CosmosDbConsistencyLevel = "Session",

    [string]
    [Parameter(Mandatory=$false)]
    $CosmosDbPrimaryRegion = "Korea Central",

    [bool]
    [Parameter(Mandatory=$false)]
    $CosmosDbEnableServerless = $true,

    [string]
    [Parameter(Mandatory=$false)]
    [ValidateSet("Local", "Zone", "Geo")]
    $CosmosDbBackupStorageRedundancy = "Local",
    ### Cosmos DB ###

    ### Communication Services ###
    [string]
    [Parameter(Mandatory=$false)]
    [ValidateSet("Africa", "Asia Pacific", "Australia", "Brazil", "Canada", "Europe", "France", "Germany", "India", "Japan", "Korea", "United Kingdom", "United States")]
    $CommunicationServiceDataLocation = "Korea",
    ### Communication Services ###

    ### Static Web App ###
    [string]
    [Parameter(Mandatory=$false)]
    [ValidateSet("centralus", "eastus2", "eastasia", "westeurope", "westus2")]
    $StaticWebAppLocation = "eastasia",

    [string]
    [Parameter(Mandatory=$false)]
    [ValidateSet("Free", "Standard")]
    $StaticWebAppSkuName = "Free",

    [bool]
    [Parameter(Mandatory=$false)]
    $StaticWebAppAllowConfigFileUpdates = $true,

    [string]
    [Parameter(Mandatory=$false)]
    [ValidateSet("Disabled", "Enabled")]
    $StaticWebAppStagingEnvironmentPolicy = "Enabled",
    ### Static Web App ###

    ### Target Scope ###
    [string]
    [Parameter(Mandatory=$false)]
    [ValidateSet("ResourceGroup", "Subscription")]
    $TargetScope = "ResourceGroup",
    ### Target Scope ###

    [switch]
    [Parameter(Mandatory=$false)]
    $WhatIf,

    [switch]
    [Parameter(Mandatory=$false)]
    $Help
)

function Show-Usage {
    Write-Output "    This provisions resources to Azure

    Usage: $(Split-Path $MyInvocation.ScriptName -Leaf) ``
            -ResourceGroupName <resource group name> ``
            -ResourceName <resource name> ``
            [-Location <location>] ``

            [-CosmosDbAccountOfferType <Cosmos DB account type>] ``
            [-CosmosDbAutomaticFailover <`$true|`$false>] ``
            [-CosmosDbConsistencyLevel <Cosmos DB consistency level>] ``
            [-CosmosDbPrimaryRegion <Cosmos DB primary region>] ``
            [-CosmosDbEnableServerless <`$true|`$false>] ``
            [-CosmosDbBackupStorageRedundancy <Cosmos DB backup storage redundancy>] ``

            [-CommunicationServiceDataLocation <Data location for Communication Services> ``

            [-StaticWebAppLocation <Static Web App location>] ``
            [-StaticWebAppSkuName <Static Web App SKU name>] ``
            [-StaticWebAppAllowConfigFileUpdates <`$true|`$false>] ``
            [-StaticWebAppStagingEnvironmentPolicy <Static Web App staging envronment policy>] ``

            [-TargetScope <Target scope>] ``

            [-WhatIf] ``
            [-Help]

    Options:
        -ResourceGroupName                Resource group name.
                                          Default is empty string.
                                          But if -TargetScope is ResourceGroup,
                                          it must be specified.
        -ResourceName                     Resource name.
        -Location                         Resource location.
                                          Default is 'koreacentral'.

        -CosmosDbAccountOfferType         Cosmos DB account type.
                                          Default is 'Standard'.
        -CosmosDbAutomaticFailover        To enable failover or not.
                                          Default is `$true.
        -CosmosDbConsistencyLevel         Cosmos DB consistency level.
                                          Default is 'Session'.
        -CosmosDbPrimaryRegion            Cosmos DB primary region.
                                          Default is 'Korea Central'.
        -CosmosDbEnableServerless         To enable serverless or not.
                                          Default is `$true.
        -CosmosDbBackupStorageRedundancy  Cosmos DB backup storage redundancy.
                                          Default is 'Local'.

        -CommunicationServiceDataLocation Data location for Communication Services.
                                          Default is 'Korea'.

        -StaticWebAppLocation             Static Web App location>
                                          Default is 'eastasia'.
        -StaticWebAppSkuName              Static Web App SKU name.
                                          Default is 'Free'.
        -StaticWebAppAllowConfigFileUpdates
                                          To allow config file update or not.
                                          Default is `$true.
        -StaticWebAppStagingEnvironmentPolicy
                                          Staging environment policy.
                                          Default is 'Enabled'.

        -WhatIf:                          Show what would happen without
                                          actually provisioning resources.
        -Help:                            Show this message.
"

    Exit 0
}

# Show usage
$needHelp = ($ResourceName -eq "") -or ($Help -eq $true)
if ($needHelp -eq $true) {
    Show-Usage
    Exit 0
}

$needHelp = ($TargetScope -eq "ResourceGroup") -and ($ResourceGroupName -eq "")
if ($needHelp -eq $true) {
    Show-Usage
    Exit 0
}

# Build parameters
$params = @{
    name = @{ value = $ResourceName };

    cosdbaAccountOfferType = @{ value = $CosmosDbAccountOfferType };
    cosdbaAutomaticFailover = @{ value = $CosmosDbAutomaticFailover };
    cosdbaConsistencyLevel = @{ value = $CosmosDbConsistencyLevel };
    cosdbaPrimaryRegion = @{ value = $CosmosDbPrimaryRegion };
    cosdbaEnableServerless = @{ value = $CosmosDbEnableServerless };
    cosdbaBackupStorageRedundancy = @{ value = $CosmosDbBackupStorageRedundancy };

    acsvcDataLocation = @{ value = $CommunicationServiceDataLocation };

    sttappLocation = @{ value = $StaticWebAppLocation };
    sttappSkuName = @{ value = $StaticWebAppSkuName };
    sttappAllowConfigFileUpdates = @{ value = $StaticWebAppAllowConfigFileUpdates };
    sttappStagingEnvironmentPolicy = @{ value = $StaticWebAppStagingEnvironmentPolicy };
}

if ($TargetScope -eq "ResourceGroup") {
    $params.cosdbaLocation = @{ value = $Location };
} else {
    $params.location = @{ value = $Location };
}

# Uncomment to debug
# $params | ConvertTo-Json
# $params | ConvertTo-Json -Compress
# $params | ConvertTo-Json -Compress | ConvertTo-Json

$stringified = $params | ConvertTo-Json -Compress | ConvertTo-Json

# Provision the resources
if ($WhatIf -eq $true) {
    Write-Output "[$(Get-Date -Format "yyyy-MM-dd HH:mm:ss")] Provisioning resources as a test ..."

    if ($TargetScope -eq "ResourceGroup") {
        az deployment group create -g $ResourceGroupName -n $TargetScope `
            -f ./main.bicep `
            -p $stringified `
            -w
    } else {
        az deployment sub create -l $Location -n $TargetScope `
            -f ./azuredeploy.bicep `
            -p $stringified `
            -w
    }

} else {
    Write-Output "[$(Get-Date -Format "yyyy-MM-dd HH:mm:ss")] Provisioning resources ..."

    if ($TargetScope -eq "ResourceGroup") {
        az deployment group create -g $ResourceGroupName -n $TargetScope `
            -f ./main.bicep `
            -p $stringified `
            --verbose
    } else {
        az deployment sub create -l $Location -n $TargetScope `
            -f ./azuredeploy.bicep `
            -p $stringified `
            --verbose
    }

    Write-Output "[$(Get-Date -Format "yyyy-MM-dd HH:mm:ss")] Resources have been provisioned"
}
