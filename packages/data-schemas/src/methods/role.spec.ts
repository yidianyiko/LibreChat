import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { SystemRoles, PermissionTypes, Permissions } from 'librechat-data-provider';
import { createRoleMethods } from './role';
import roleSchema from '~/schema/role';

let mongoServer: MongoMemoryServer;
let Role: mongoose.Model<unknown>;
let methods: ReturnType<typeof createRoleMethods>;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  Role = mongoose.models.Role || mongoose.model('Role', roleSchema);
  methods = createRoleMethods(mongoose);
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await mongoose.connection.dropDatabase();
});

describe('initializeRoles', () => {
  test('backfills a newly-added permission field without clobbering existing ones', async () => {
    // Simulate a role persisted before SHARE/SHARE_PUBLIC existed on PROMPTS:
    // the block is non-empty (USE/CREATE set), but missing the newer fields.
    await Role.create({
      name: SystemRoles.USER,
      permissions: {
        [PermissionTypes.PROMPTS]: {
          [Permissions.USE]: false,
          [Permissions.CREATE]: false,
        },
      },
    });

    await methods.initializeRoles();

    const roles = await methods.listRoles();
    const userRole = roles.find((r) => r.name === SystemRoles.USER);
    const promptsPerms = userRole?.permissions?.[PermissionTypes.PROMPTS] as Record<
      string,
      boolean
    >;

    // Pre-existing fields must be preserved as-is, not reset to defaults.
    expect(promptsPerms[Permissions.USE]).toBe(false);
    expect(promptsPerms[Permissions.CREATE]).toBe(false);
    // Missing fields must be backfilled from defaults rather than left absent.
    expect(promptsPerms[Permissions.SHARE]).toBeDefined();
    expect(promptsPerms[Permissions.SHARE_PUBLIC]).toBeDefined();
  });

  test('creates default roles when none exist', async () => {
    await methods.initializeRoles();
    const roles = await methods.listRoles();
    expect(roles.map((r) => r.name).sort()).toEqual([SystemRoles.ADMIN, SystemRoles.USER].sort());
  });
});
