import { App, Aspects, Names, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  Architecture,
  InlineCode,
  Runtime,
  Function as CoreFunction,
} from "aws-cdk-lib/aws-lambda";
import { ExpectedResult, IntegTest } from "@aws-cdk/integ-tests-alpha";

import { Function, CostLimit } from "../lib";

const app = new App();

class StackUnderTest extends Stack {
  public functionName: string;
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const nodejsFunction = new Function(this, "Handler", {
      architecture: Architecture.X86_64,
      code: InlineCode.fromInline(
        `exports.handler = (event, context, callback) => { setTimeout(callback(null, "hello world from Lambda ${Names.uniqueId(
          scope
        )}"), 100) }`
      ),
      memorySize: 512,
      runtime: Runtime.NODEJS_16_X,
      handler: "index.handler",
      budget: 100,
    });

    const aspectFunction = new CoreFunction(this, "Handler2", {
      architecture: Architecture.ARM_64,
      code: InlineCode.fromInline(
        `exports.handler = (event, context, callback) => { setTimeout(callback(null, "hello world from Lambda ${Names.uniqueId(
          scope
        )}"), 100) }`
      ),
      memorySize: 512,
      runtime: Runtime.NODEJS_16_X,
      handler: "index.handler",
    });

    Aspects.of(aspectFunction).add(new CostLimit({ budget: 200 }));
    Aspects.of(this).add(new CostLimit({ budget: 1000 }));

    this.functionName = nodejsFunction.functionName;
  }
}

const stackUnderTest = new StackUnderTest(app, "StackUnderTest", {});
const integ = new IntegTest(app, "Integ", {
  testCases: [stackUnderTest],
});

const invoke = integ.assertions.invokeFunction({
  functionName: stackUnderTest.functionName,
});
invoke.expect(
  ExpectedResult.objectLike({
    Payload: "200",
  })
);
