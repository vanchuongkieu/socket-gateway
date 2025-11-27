# WebSocket Documentation

## Supported Send Events

- `message.send`: Send a message
- `message.read`: Mark a message as read
- `user.update`: Update user profile

## Received Events

- `conversation.created`: A new conversation was created
- `message.new`: A new message has been received
- `message.read`: A message was marked as read
- `error`: An error occurred

## Connection Example

```js
const ws = new WebSocket('<ServerUrl>/gateway/<TenantCode>/conversation?sid=<SecretKey>&uid=<UserId>')

ws.onopen = () => {
  console.log('WebSocket connected')
}

ws.onmessage = ({ data }) => {
  const msg = JSON.parse(data)

  // Output "msg":
  //   console.log({
  //     "event": "...",
  //     "data": {...}
  //   })
}
```

## Send Message

```js
ws.send(
  JSON.stringify({
    event: 'message.send',
    data: {
      senderId, // ID of the sender
      recipientIds, // Array of recipient user IDs
      senderName, // Name of the sender
      conversationId, // Conversation ID, or null if this is a new conversation
      content, // Text content of the message
      images, // Array of image URLs (optional)
    },
  }),
)
```

### When conversationId is null

- The system will create a new conversation automatically
- A `conversation.created` event will be sent back with the new `conversationId`
- The client should store the `conversationId` for future messages

## Read message

```js
ws.send(
  JSON.stringify({
    event: 'message.read',
    data: {
      senderId, // ID of the sender
      conversationId, // ID of the conversation
    },
  }),
)
```

## Update or create user profile

```js
ws.send(
  JSON.stringify({
    event: 'user.update',
    data: {
      senderId, // ID of the user
      senderName, // Name of the user
      senderAvatar, // URL of the user's avatar
    },
  }),
)
```
