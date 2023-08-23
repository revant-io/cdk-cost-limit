import path = require("path");
import { Construct, IConstruct } from "constructs";
import {
  Function as CoreFunction,
  FunctionProps as CoreFunctionProps,
} from "aws-cdk-lib/aws-lambda";
import { Architecture, Code, LayerVersion } from "aws-cdk-lib/aws-lambda";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import { IAspect, Stack } from "aws-cdk-lib";
import { Effect, IRole, Policy, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { table } from "console";

// Env variables names used internally - duplicated in extension code, should be deduplicated
const ENV_VARIABLE_REVANT_COST_TABLE_NAME = "REVANT_COST_TABLE_NAME"
const ENV_VARIABLE_REVANT_COST_LIMIT = "REVANT_COST_LIMIT"

class CoreRessources extends Construct {
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

type CostLimitProps = {
  /**
   * The budget allocated to this resource in $US cents.
   * For exemple, if you want to set a budget of $1,00 for a specific Lambda, you
   * should used a value of 100 for this prop.
   *
   * @default undefined - Unlimited budget
   */
  readonly budget?: number;
};

type FunctionProps = CostLimitProps & CoreFunctionProps;
export class Function extends CoreFunction {
  public static limitBudget(functionConstruct: CoreFunction, budget: number) {
    const { layer, dynamoDBTable } =
      CoreRessources.getInstance(functionConstruct);
    dynamoDBTable.grant(functionConstruct, "dynamodb:UpdateItem");

    functionConstruct.addLayers(layer);
    functionConstruct.addEnvironment(ENV_VARIABLE_REVANT_COST_LIMIT, budget.toString());
    functionConstruct.addEnvironment(ENV_VARIABLE_REVANT_COST_TABLE_NAME, dynamoDBTable.tableName);
    const policyStatement = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["lambda:PutFunctionConcurrency"],
      resources: [functionConstruct.functionArn],
    });
    const policy = new Policy(functionConstruct, "SelfDisablePolicy", {
      statements: [policyStatement],
    });
    policy.attachToRole(functionConstruct.role as IRole);
  }

  constructor(
    scope: Construct,
    id: string,
    { budget, ...functionProps }: FunctionProps
  ) {
    super(scope, id, functionProps);

    if (budget === undefined) {
      // No budget restriction, early return
      return;
    }

    Function.limitBudget(this, budget);
  }
}

export class CostLimit implements IAspect {
  private budget: number;
  constructor({ budget }: Required<CostLimitProps>) {
    this.budget = budget;
  }
  public visit(node: IConstruct): void {
    if (node instanceof CoreFunction) {
      Function.limitBudget(node, this.budget);
    }
  }
}
