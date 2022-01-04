import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { getUserInfo, isAuthenticated} from "@aaronpowell/static-web-apps-api-auth";
import { CommunicationIdentityClient } from "@azure/communication-identity";
import { CommunicationUserIdentifier, AzureCommunicationTokenCredential } from '@azure/communication-common'

// TODO: 
// To make this sample work, you need to create an Azure Communication Services in the Azure Portal
// And create a Cosmos DB named 'ACS' with a table named 'users'
//
// Then, create those env variables (or update them for local testing in local.settings.json)
// - ACS_ConnectionString: pointing to your ACS connection string found in your Azure Portal
// - MyAccount_COSMOSDB: pointing to your Cosmos DB connection string found in your Azure Portal
var connectionString = "";

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    context.log('HTTP trigger function processed a request.');
    let userId;
    let user;
    let userToken;
    let acsToken;

    // Only authenticated users can call this API
    if (!isAuthenticated(req) && process.env["ACS_ConnectionString"]) {
        context.res = {
            body: "You are not logged in at the moment"
        };
    } else {
        if (process.env["ACS_ConnectionString"]) {
            connectionString = process.env["ACS_ConnectionString"];
        }

        // If the user has already been created, let's check the token validity
        if (context.bindings.getUser) {
            let expiresOn = context.bindings.getUser.expiresOn;
            let expiresOnDate = new Date(expiresOn);
            let currentDate = new Date();
            if (currentDate > expiresOnDate) {
                // Token has expired, we need to refresh it
                let tokenClient = new CommunicationIdentityClient(connectionString);
                user = new AzureCommunicationTokenCredential(context.bindings.getUser.userToken);
                userToken = await user.getToken();
                context.bindings.setUser = JSON.stringify({
                    id: context.bindingData.email,
                    userToken: userToken.token,
                    expiresOn: new Date(userToken.expiresOnTimestamp),
                    userId: context.bindings.getUser.userId
                });
            }
            userId = context.bindings.getUser.userId;
            acsToken = context.bindings.getUser.userToken;
            context.log('User: ' + context.bindings.getUser);
        }
        // Creating a new ACS identity based on the email provided
        else {
            let tokenClient = new CommunicationIdentityClient(connectionString);
            user = await tokenClient.createUser();
            userToken = await tokenClient.getToken(user, ["voip"]);
            
            // This is the GUID used by ACS to identity a user
            userId = user.communicationUserId;
            acsToken = userToken.token;

            context.bindings.setUser = JSON.stringify({
                id: context.bindingData.email,
                userToken: userToken.token,
                expiresOn: userToken.expiresOn,
                userId: user.communicationUserId
            });
        }

        var returnJSON = {
            userId: userId,
            userToken: acsToken
        }

        context.res = {
            body: JSON.stringify(returnJSON)
        };
    }

    context.done();
};

export default httpTrigger;