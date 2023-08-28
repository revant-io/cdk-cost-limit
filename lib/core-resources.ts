import path from "path";
import { Construct } from "constructs";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import { Architecture, Code, LayerVersion } from "aws-cdk-lib/aws-lambda";
import { Stack } from "aws-cdk-lib";
import { Effect, Policy, PolicyStatement } from "aws-cdk-lib/aws-iam";

export class CoreRessources extends Construct {
  public dynamoDBTable: Table;
  public layerX86: LayerVersion;
  public layerARM: LayerVersion;
  public policy: Policy;
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

    const policyStatement = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["lambda:PutFunctionConcurrency"],
      resources: ["*"],
      // Not sure the following condition is working, to be checked later using https://docs.aws.amazon.com/lambda/latest/dg/lambda-api-permissions-ref.html#permissions-resources-function
      // conditions: {
      //   "ArnEquals": {
      //       "lambda:FunctionArn": ["${aws:SourceArn}"]
      //   }
      // }
    });
    this.policy = new Policy(scope, "SelfDisablePolicy", {
      statements: [policyStatement],
    });
  }

  public static getInstance(scope: Construct): CoreRessources {
    if (!CoreRessources.instance) {
      CoreRessources.instance = new CoreRessources(Stack.of(scope));
    }
    return CoreRessources.instance;
  }
}
