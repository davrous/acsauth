import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { getUserInfo, isAuthenticated} from "@aaronpowell/static-web-apps-api-auth";
import { CommunicationIdentityClient } from "@azure/communication-identity";
import { CommunicationUserIdentifier, AzureCommunicationTokenCredential } from '@azure/communication-common'

const connectionString = 'endpoint=https://davrousacs.communication.azure.com/;accesskey=sFTj82FWbxGBmgtYWf/o4BYgYsQaWPtPRX1IpqFLpMaSlzOXdDmLZr1K4m31JFxABfrINGCX0sTcZlENm9efQA==';

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    context.log('HTTP trigger function processed a request.');
    let userId;
    let user;
    let userToken;

    if (!isAuthenticated(req)) {
        context.res = {
            body: "You are not logged in at the moment"
        };
    } else {
        var authuser = getUserInfo(req);

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
            context.log('User: ' + context.bindings.getUser);
        }
        // Creating a new ACS identity based on the email provided
        else {
            let tokenClient = new CommunicationIdentityClient(connectionString);
            user = await tokenClient.createUser();
            userToken = await tokenClient.getToken(user, ["voip"]);
            
            // This is the GUID used by ACS to identity a user
            userId = user.communicationUserId;

            context.bindings.setUser = JSON.stringify({
                id: context.bindingData.email,
                userToken: userToken.token,
                expiresOn: userToken.expiresOn,
                userId: user.communicationUserId
            });
        }

        context.res = {
            body: userId
        };
    }

    context.done();
};

export default httpTrigger;