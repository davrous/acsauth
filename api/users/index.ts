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
    let userId = "";
    let user;
    let userToken;
    let acsToken;
    let tokenExpiresOn;
    let returnJSON;

    // API is called only to try to resolved an email for an ACS User ID
    if (context.bindingData.lookup) {
        // If the user has been found in DB
        if (context.bindings.getUser) {
            userId = context.bindings.getUser.userId;
            context.log('User: ' + context.bindings.getUser);
        }
    
        returnJSON = {
            userId: userId,
        }
    
        context.res = {
            body: JSON.stringify(returnJSON)
        };
        
        context.done();
    }
    // Otherwise, we try to create a new ACS User ID or refresh its access token
    else {
        // Only authenticated users can call this API
        if (!isAuthenticated(req) && process.env["ACS_ConnectionString"]) {
            context.res = {
                body: "Please login first."
            };
        } else {
            if (process.env["ACS_ConnectionString"]) {
                connectionString = process.env["ACS_ConnectionString"];
            }

            let currentDate = new Date();

            // If the user has already been created & the token is still valid
            if (context.bindings.getUser && new Date(context.bindings.getUser.expiresOn) > currentDate) {
                tokenExpiresOn = context.bindings.getUser.expiresOn;
                userId = context.bindings.getUser.userId;
                acsToken = context.bindings.getUser.userToken;
            }
            // User not found yet or token has expired, we need to refresh it
            // Creating a new ACS identity based on the email provided
            else {
                let tokenClient = new CommunicationIdentityClient(connectionString);
                user = await tokenClient.createUser();
                userToken = await tokenClient.getToken(user, ["voip", "chat"]);
                
                // This is the GUID used by ACS to identity a user
                userId = user.communicationUserId;
                acsToken = userToken.token;
                tokenExpiresOn = userToken.expiresOn;

                context.bindings.setUser = JSON.stringify({
                    id: context.bindingData.email,
                    userToken: acsToken,
                    expiresOn: tokenExpiresOn,
                    userId: userId
                });
            }

            returnJSON = {
                userId: userId,
                userToken: acsToken,
                expiresOn: tokenExpiresOn
            }

            context.res = {
                body: JSON.stringify(returnJSON)
            };
        }

        context.done();
    }
};

export default httpTrigger;