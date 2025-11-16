import { exchangeCodeForTokens } from '../../lib/outlookClient';

// Extract the code from the URL you provided
const code = '1.AcoA63BO-SnGj0emgCAak9WX-c7NiRPXdgtAnIEhrfwuewlcAQDKAA.AgABBAIAAABlMNzVhAPUTrARzfQjWPtKAwDs_wUA9P_Sb8pS_9otnM8Tzt3i6bbInl8Mta1EUggxO-Kf2DWSuZ2JeTuGZIdsE96CbUQHN5ZiaN0ZE03-FB-vUQl5_I1X63zvujAZoPIerEAXKXV022q-O9EMpg6D89onAGxaYdgksbkHlASTRazkzzMR1MuHa6zpQFKosmeEYkM3QrS09H-0IX9MvLiY4cLresk-v2ZhO7oBwxxUezH4wmmFVnVWExsfwFIr7SQqlJIVU0xf9H_w_Z95MO48MG9KLi5tjbim8f9oI2kMBdpANm7w3O03dgP_A6mqHEx6d5CwlTP40WPjJx6Ro858Nvgvm81GXTOfPm29XjSbj6XWZDMKwaFkEunHqOj1ZOgUlcgQXjD9ituZJ_uHmxsHYGfiqNwXYMT1gFE1SuYIzpnrRMDv6ahWAUetF01IQRPgkMEtRcL3gKGn9AWEgDDSpe4aGpR0DLA82EKJ8R2WR5ueAX2RUE4Tlp1s0PbCb_rb7h3J3fc-2jSfiAZQowL6jcTFPT6iyaerEFvRQJHkzGWBBc72H9grrDZa5uT-j1a7RQm2cBskVQW32QPYF44Q1INmtJ61rm1GQBqkCL4-_2XOUqmjenIZbelNy1TCle97ht59nNCA4KePb9368bqdw996XypJq8FEHRqu2eGPJ4qpZgib3yNeCtkTUBBAG6f1Way-pqJpGDfdtjUsCqMA8Q9ZAJHbH-8dC7JWUYjBZq4tbiDJHFzCWZX55-z-FUUVRBaYfmK0SOqQPkkYmEo0oyDL_QTdOxalM5HE2FrbXYb3oedGiEDc2gLfx92qZc_6PZSNMsrlVqPNDWyccP0QV95FrQRybtYGgVD_K_dPO3l61wwBkfsciUcw9r5M9N8UeYWqynCBN_7gOCKYXk4MVR54bydysHfYmjimh-_A55YdmwblKR-g1sc2AGvf2q47PliQD9WnFsdpEAZVCj72ahRvRzocggzqapYOvkti93Ld7F6nVfbMFedgW98Oot8Qw01_Zf_qIahwnNpPWKjijGpYlfbxdCYHsVMQcOZdNBF7gvz8fD_D0DCY8amYN9ezj9mig-rhHh-OVAE';

async function main() {
  try {
    console.log('🔄 Exchanging authorization code for tokens...');
    const tokenData = await exchangeCodeForTokens(code);
    console.log('✅ Successfully stored Outlook tokens!');
    console.log('📋 Token details:');
    console.log(`   - Expires in: ${tokenData.expires_in} seconds`);
    console.log(`   - Scope: ${tokenData.scope}`);
    console.log('✅ Outlook calendar sync is now active!');
  } catch (error: any) {
    console.error('❌ Error exchanging code:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

main();


