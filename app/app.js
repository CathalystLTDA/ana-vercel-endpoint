const whatsappClient = require('./src/modules/whatsapp/WhatsAppClient');

whatsappClient.init()
    .then(() => {
        console.log('WhatsApp client succesfully initialized.');
    })
    .catch((error) => {
        console.error('Failed to initialize WhatsApp client', error);
    });
