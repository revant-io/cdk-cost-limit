import path from "path";
import { Construct } from "constructs";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import { Architecture, Code, LayerVersion } from "aws-cdk-lib/aws-lambda";
import { Stack } from "aws-cdk-lib";

export class CoreRessources extends Construct {
    public dynamoDBTable: Table;
    public layer: LayerVersion;
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
  
      this.layer = new LayerVersion(this, "LambdaExtensionLayer", {
        code: Code.fromAsset(path.join(__dirname, "./layer")),
        compatibleArchitectures: [Architecture.X86_64, Architecture.ARM_64],
      });
    }
  
    public static getInstance(scope: Construct): CoreRessources {
      if (!CoreRessources.instance) {
        CoreRessources.instance = new CoreRessources(Stack.of(scope));
      }
      return CoreRessources.instance;
    }
  }