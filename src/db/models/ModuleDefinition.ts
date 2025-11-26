import { Schema, model, type Document } from 'mongoose';

export interface ModuleDependency {
  moduleKey: string;
  required: boolean;
}

export interface ModuleDefinitionDocument extends Document {
  moduleKey: string;
  label: string;
  description?: string;
  version: string;
  dependencies: ModuleDependency[];
  createdAt: Date;
  updatedAt: Date;
}

const ModuleDefinitionSchema = new Schema<ModuleDefinitionDocument>(
  {
    moduleKey: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    description: { type: String },
    version: { type: String, required: true, default: '1.0.0' },
    dependencies: [
      {
        moduleKey: { type: String, required: true },
        required: { type: Boolean, default: true }
      }
    ]
  },
  { timestamps: true }
);

export const ModuleDefinitionModel = model<ModuleDefinitionDocument>(
  'ModuleDefinition',
  ModuleDefinitionSchema
);
