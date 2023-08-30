import path from "path";
import { Construct } from "constructs";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import { Stack } from "aws-cdk-lib";
import { LambdaCommonResources } from "./services/lambda";

export class CoreRessources extends Construct {
  public dynamoDBTable: Table;
  public lambdaCommonResources: LambdaCommonResources;
  static instance: CoreRessources;

  private constructor(scope: Construct) {
    super(scope, "RevantCoreResources");

    this.dynamoDBTable = new Table(this, "CostTable", {
      partitionKey: {
        name: "PK",
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
    });

    this.lambdaCommonResources = new LambdaCommonResources(this);
  }

  public static getInstance(scope: Construct): CoreRessources {
    if (!CoreRessources.instance) {
      CoreRessources.instance = new CoreRessources(Stack.of(scope));
    }
    return CoreRessources.instance;
  }
}
