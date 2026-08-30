import { defineFeature } from "@threxus/runtime";
import { FactoryModelsService } from "./models.service";

export const factoryModelsFeature = defineFeature({
  name: 'factory-models',
  provides: [FactoryModelsService],
})