import { Construct } from "constructs";
import { Effect, IRole, Policy, PolicyStatement } from "aws-cdk-lib/aws-iam";
import {
  Architecture,
  Function as CoreFunction,
  FunctionProps as CoreFunctionProps,
} from "aws-cdk-lib/aws-lambda";

import { CostLimitProps } from "../cost-limit";
import { CoreRessources } from "../core-resources";

export type FunctionProps = CostLimitProps & CoreFunctionProps;

// Env variables names used internally - duplicated in extension code, should be deduplicated
const ENV_VARIABLE_REVANT_COST_TABLE_NAME = "REVANT_COST_TABLE_NAME";
const ENV_VARIABLE_REVANT_COST_LIMIT = "REVANT_COST_LIMIT";
const ENV_VARIABLE_REVANT_COST_LIMIT_PATH = "REVANT_COST_LIMIT_PATH";

export class Function extends CoreFunction {
  public static limitBudget(
    functionConstruct: CoreFunction,
    budget: number,
    path: string
  ) {
    const { layerARM, layerX86, dynamoDBTable } =
      CoreRessources.getInstance(functionConstruct);
    dynamoDBTable.grant(functionConstruct, "dynamodb:UpdateItem");

    if (functionConstruct.architecture === Architecture.ARM_64) {
      functionConstruct.addLayers(layerARM);
    }

    if (functionConstruct.architecture === Architecture.X86_64) {
      functionConstruct.addLayers(layerX86);
    }

    functionConstruct.addEnvironment(
      ENV_VARIABLE_REVANT_COST_LIMIT,
      budget.toString()
    );
    functionConstruct.addEnvironment(ENV_VARIABLE_REVANT_COST_LIMIT_PATH, path);
    functionConstruct.addEnvironment(
      ENV_VARIABLE_REVANT_COST_TABLE_NAME,
      dynamoDBTable.tableName
    );
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

    Function.limitBudget(this, budget, this.node.path);
  }
}
