import { AzureFunction, Context, HttpRequest } from "@azure/functions";

// TODO: 
// To make this sample work, you need to create a Cosmos DB named 'ACS' with a table named 'users'
//
// Then, create those env variables (or update them for local testing in local.settings.json
// - MyAccount_COSMOSDB: pointing to your Cosmos DB connection string found in your Azure Portal
var connectionString = "";

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    context.log('HTTP trigger function processed a request.');
    let userId = "";

    // If the user has been found in DB
    if (context.bindings.getUser) {
        userId = context.bindings.getUser.userId;
        context.log('User: ' + context.bindings.getUser);
    }

    var returnJSON = {
        userId: userId,
    }

    context.res = {
        body: JSON.stringify(returnJSON)
    };
    
    context.done();
};

export default httpTrigger;