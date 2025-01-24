export default {
  async fetch(request, env, ctx) {

    const wsUrl = 'wss://wss.nobitex.ir/connection/websocket';
    const symbol = 'USDTIRT'
    const caption = 'دلار'

    const tgBotToken = '8090655566:BBG8fGGM5bIzXdqIj4XBQ5h5tys_f6OOyiY';
    const tgChannel = '@mychannel';

    const sendToTelegram = async (message) => {
      const tgApiUrl = `https://api.telegram.org/bot${tgBotToken}/sendMessage`;
      const body = {
        chat_id: tgChannel,
        text: message,
      };

      try {
        const response = await fetch(tgApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          console.error('Failed to send message to Telegram:', await response.text());
        }
      } catch (error) {
        console.error('Error sending message to Telegram:', error);
      }
    };

    const savePriceToKV = async (price) => {
      await env.gheymat_link.put('USDTIRT', price.toString());
    };

    const getLastPriceFromKV = async () => {
      const lastPrice = await env.gheymat_link.get('USDTIRT');
      return lastPrice ? parseFloat(lastPrice) : null;
    };

    return new Promise((resolve) => {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('Connected to WebSocket server.');

        // Send connection message
        ws.send(JSON.stringify({
          connect: { name: 'js' },
          id: 3
        }));

        // Send subscription message
        ws.send(JSON.stringify({
          subscribe: {
            channel: 'public:orderbook-'+symbol,
            recover: true,
            offset: 0,
            epoch: '0',
            delta: 'fossil'
          },
          id: 4
        }));
      };

      ws.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.id === 4 && message.subscribe && message.subscribe.publications) {
            const publication = message.subscribe.publications[0];
            if (publication && publication.data) {
              const parsedData = JSON.parse(publication.data);
              if (parsedData.asks && parsedData.asks.length > 0) {
                const current_price = parsedData.asks[0][0] / 10;
               

                const lastPrice = await getLastPriceFromKV();
                let trend = '';

                if (lastPrice !== null) {
                  trend = current_price > lastPrice ? '🟢' : current_price < lastPrice ? '🔴' : '⚪️';

                }
                const cbreak = "‎\n"
                const hiddenBr = "ㅤㅤㅤㅤㅤ"+"\n"
                await savePriceToKV(current_price);
                const formattedNumber = new Intl.NumberFormat('en-US').format(current_price);
                await sendToTelegram(`${cbreak}${trend} ${caption}: ${formattedNumber} تومن${cbreak}${cbreak}${hiddenBr}`);

                ws.close(); // Close the WebSocket connection
                resolve(new Response(`sent to Telegram: ${current_price}`));
              }
            }
          }
        } catch (error) {
          console.error('Error parsing message:', error);
          resolve(new Response('Error parsing message.', { status: 500 }));
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        resolve(new Response('WebSocket error.', { status: 500 }));
      };

      ws.onclose = () => {
        console.log('WebSocket connection closed.');
      };
    });
  },
} 

