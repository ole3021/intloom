Queue design review
Maya: We compared polling with webhooks. Polling works with our existing store but adds up to 30 seconds of delay.
Lee: Webhooks need a public endpoint. Our pilot sites cannot accept inbound connections.
Maya: Agreed. Use polling for the pilot. We accept the 30-second delay. Revisit webhooks if the sites allow inbound connections.
