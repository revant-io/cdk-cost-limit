import path from "path";
import { Construct } from "constructs";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import { Architecture, Code, LayerVersion } from "aws-cdk-lib/aws-lambda";
import { Stack } from "aws-cdk-lib";

export class CoreRessources extends Construct {
    public dynamoDBTable: Table;
    public layerX86: LayerVersion;
    public layerARM: LayerVersion;
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
  
      this.layerX86 = new LayerVersion(this, "LambdaExtensionLayerX86", {
        code: Code.fromAsset(path.join(__dirname, "./layerX86")),
        compatibleArchitectures: [Architecture.X86_64],
      });
  
      this.layerARM = new LayerVersion(this, "LambdaExtensionLayerARM", {
        code: Code.fromAsset(path.join(__dirname, "./layerARM")),
        compatibleArchitectures: [Architecture.X86_64],
      });
    }
  
    public static getInstance(scope: Construct): CoreRessources {
      if (!CoreRessources.instance) {
        CoreRessources.instance = new CoreRessources(Stack.of(scope));
      }
      return CoreRessources.instance;
    }
  }