/**
 * Test script for Brevo email sending
 * Usage: node test-brevo-email.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const sendEmail = require('./api/server/utils/sendEmail');

async function testEmail() {
  console.log('='.repeat(60));
  console.log('Testing Brevo Email Configuration');
  console.log('='.repeat(60));

  // Display current config
  console.log('\n📧 Current Email Configuration:');
  console.log(`  Host: ${process.env.EMAIL_HOST}`);
  console.log(`  Port: ${process.env.EMAIL_PORT}`);
  console.log(`  Encryption: ${process.env.EMAIL_ENCRYPTION}`);
  console.log(`  Username: ${process.env.EMAIL_USERNAME}`);
  console.log(`  From: ${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`);

  console.log('\n📨 Sending test email to 1769450996@qq.com...\n');

  try {
    const result = await sendEmail({
      email: '1769450996@qq.com',
      subject: 'keep4oforever Brevo 邮件测试 🎉',
      template: 'verifyEmail.handlebars',
      payload: {
        name: '测试用户',
        appName: process.env.APP_TITLE || 'keep4oforever',
        verificationLink: 'http://localhost:3080/verify-test-success',
        year: new Date().getFullYear(),
      },
    });

    console.log('✅ Email sent successfully!');
    console.log('\nResponse:', result);
    console.log('\n' + '='.repeat(60));
    console.log('✓ Test completed - Check inbox at 1769450996@qq.com');
    console.log('  - Subject: "keep4oforever Brevo 邮件测试 🎉"');
    console.log('  - From: keep4o <yidianyiko123@gmail.com>');
    console.log('  - App Name: keep4oforever');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('\n❌ Email sending failed!');
    console.error('\nError details:');
    console.error(error);
    console.log('\n' + '='.repeat(60));
    console.log('✗ Test failed - See error above');
    console.log('='.repeat(60));
    process.exit(1);
  }
}

testEmail();
