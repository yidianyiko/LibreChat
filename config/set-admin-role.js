const path = require('path');
const mongoose = require('mongoose');
const { SystemRoles } = require('librechat-data-provider');
const { User } = require('@librechat/data-schemas').createModels(mongoose);
require('module-alias')({ base: path.resolve(__dirname, '..', 'api') });
const { askQuestion, silentExit } = require('./helpers');
const connect = require('./connect');

(async () => {
  await connect();

  /**
   * Show welcome / help menu
   */
  console.purple('---------------------------');
  console.purple('Set user role to ADMIN!');
  console.purple('---------------------------');

  /**
   * Set up variables we need and get arguments if they were passed in
   */
  let email = '';
  // If we have right number of arguments, lets use them
  if (process.argv.length >= 3) {
    email = process.argv[2];
  } else {
    console.orange('Usage: npm run set-admin-role <email>');
    console.orange('Note: if you do not pass in arguments, you will be prompted for them.');
    console.purple('---------------------------');
  }

  /**
   * If we don't have right number of arguments, lets prompt user for them
   */
  if (!email) {
    email = await askQuestion('Email:');
  }
  // Validate email
  if (!email.includes('@')) {
    console.red('Error: Invalid email address!');
    silentExit(1);
  }

  // Validate user
  const user = await User.findOne({ email }).lean();
  if (!user) {
    console.red('Error: No user with that email was found!');
    silentExit(1);
  } else {
    console.purple(`Found user: ${user.email}`);
    console.purple(`Current role: ${user.role || 'USER'}`);
  }

  /**
   * Now that we have all variables we need, lets set admin role
   */
  let result;
  try {
    result = await User.findByIdAndUpdate(
      user._id,
      { $set: { role: SystemRoles.ADMIN } },
      { new: true }
    ).lean();
  } catch (error) {
    console.red('Error: ' + error.message);
    console.error(error);
    silentExit(1);
  }

  // Check result
  if (!result) {
    console.red('Error: Something went wrong while updating user role!');
    silentExit(1);
  }

  // Done!
  console.green('User role set to ADMIN successfully!');
  console.purple(`New role: ${result.role}`);
  silentExit(0);
})();

process.on('uncaughtException', (err) => {
  if (!err.message.includes('fetch failed')) {
    console.error('There was an uncaught error:');
    console.error(err);
  }

  if (err.message.includes('fetch failed')) {
    return;
  } else {
    process.exit(1);
  }
});
