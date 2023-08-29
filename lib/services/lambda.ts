import { Construct } from "constructs";
import { IRole } from "aws-cdk-lib/aws-iam";
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
const ENV_VARIABLE_REVANT_COST_LIMIT_PREFIX = "REVANT_COST_LIMIT";

export class Function extends CoreFunction {
  public static limitBudget(
    functionConstruct: CoreFunction,
    budget: number,
    address: string
  ) {
    const { layerARM, layerX86, dynamoDBTable, policy } =
      CoreRessources.getInstance(functionConstruct);
    dynamoDBTable.grant(functionConstruct, "dynamodb:UpdateItem");

    if (
      functionConstruct.architecture === Architecture.ARM_64 &&
      !functionConstruct._layers.includes(layerARM)
    ) {
      functionConstruct.addLayers(layerARM);
    }

    if (
      functionConstruct.architecture === Architecture.X86_64 &&
      !functionConstruct._layers.includes(layerX86)
    ) {
      functionConstruct.addLayers(layerX86);
    }

    functionConstruct.addEnvironment([ENV_VARIABLE_REVANT_COST_LIMIT_PREFIX, address].join("_"), budget.toString())
    functionConstruct.addEnvironment(
      ENV_VARIABLE_REVANT_COST_TABLE_NAME,
      dynamoDBTable.tableName
    );
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

    Function.limitBudget(this, budget, this.node.addr);
  }
}
