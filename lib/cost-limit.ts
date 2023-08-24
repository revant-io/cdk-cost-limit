import { IAspect } from "aws-cdk-lib";
import { IConstruct } from "constructs";
import { Function as CoreFunction } from "aws-cdk-lib/aws-lambda";
import { Function } from "./services/lambda";

export type CostLimitProps = {
  /**
   * The budget allocated to this resource in $US cents.
   * For exemple, if you want to set a budget of $1,00 for a specific Lambda, you
   * should used a value of 100 for this prop.
   *
   * @default undefined - Unlimited budget
   */
  readonly budget?: number;
};

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
