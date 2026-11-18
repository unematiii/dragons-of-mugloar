# Database schema

The Drizzle definitions in `packages/db/src/schema.ts` and their migrations are the source of truth. This Mermaid ER diagram is a maintained view of the same schema.

```mermaid
erDiagram
    players ||--o{ sessions : authenticates
    players ||--o{ games : owns
    games ||--o{ commands : receives
    games ||--o{ actions : records
    games ||--o{ boardSnapshots : captures
    games ||--o{ shopSnapshots : captures
    games ||--o{ reputationSnapshots : captures

    players {
        uuid id PK
        datetime createdAt
    }
    sessions {
        uuid id PK
        uuid playerId FK
        string tokenHash UK
        datetime createdAt
        datetime expiresAt
        datetime revokedAt
    }
    games {
        uuid id PK
        uuid ownerId FK
        string upstreamGameId
        string status
        int lives
        int gold
        int level
        int score
        int turn
        int revision
        json rawState
        datetime createdAt
        datetime updatedAt
    }
    commands {
        uuid id PK
        uuid gameId FK
        string clientCommandId
        int expectedRevision
        string actionType
        string status
        json request
        json response
        datetime createdAt
        datetime completedAt
    }
    actions {
        uuid id PK
        uuid gameId FK
        int sequence
        string commandId
        string actionType
        string status
        string source
        json beforeState
        json afterState
        json request
        json response
        string message
        datetime createdAt
    }
    boardSnapshots {
        uuid id PK
        uuid gameId FK
        int turn
        int revision
        json rawPayload
        json normalizedAds
        string recommendedTaskId
        string recommendedItemId
        datetime observedAt
    }
    shopSnapshots {
        uuid id PK
        uuid gameId FK
        int revision
        json rawPayload
        json items
        datetime observedAt
    }
    reputationSnapshots {
        uuid id PK
        uuid gameId FK
        int turn
        float people
        float state
        float underworld
        json rawPayload
        datetime observedAt
    }
```

Deleting a game cascades to its commands, actions, and board, shop, and reputation snapshots.

Nullable columns are `sessions.revokedAt`, `commands.response`, `commands.completedAt`, `actions.afterState`, `actions.response`, `actions.message`, `boardSnapshots.recommendedTaskId`, `boardSnapshots.recommendedItemId`, and `reputationSnapshots.turn`. Composite unique constraints are `(commands.gameId, commands.clientCommandId)`, `(actions.gameId, actions.sequence)`, and `(actions.gameId, actions.commandId)`.

CLI manual and autoplay games are stored as game rows under an internal player owner. Their actions identify `manual` or `autoplay` as the source.

