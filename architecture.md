# AtomQuest Architecture Diagram

```mermaid
---
config:
  layout: elk
---
graph TB
    Employee[Employee]
    Manager[Manager]
    Admin[Admin]
    
    Employee -->|HTTPS| Frontend
    Manager -->|HTTPS| Frontend
    Admin -->|HTTPS| Frontend
    
    Frontend[React + Vite SPA]
    CDN[Vercel CDN]
    
    Frontend -->|via| CDN
    CDN -->|Global Edge| Browser[Browser Cache]
    
    Frontend -->|REST API| SupabaseAPI[Supabase REST API]
    Frontend -->|WebSocket| SupabaseRT[Supabase Realtime]
    
    SupabaseAPI -->|HTTPS| PostgreSQL[(PostgreSQL Database<br/>7 Tables + RLS)]
    SupabaseRT -->|Live Updates| PostgreSQL
    
    SupabaseAuth[Supabase Auth<br/>JWT Sessions]
    SupabaseEdge[Edge Functions<br/>Escalation Rules]
    
    SupabaseAuth -.->|JWT Tokens| Frontend
    SupabaseEdge -->|Triggers| PostgreSQL
    
    classDef userRole stroke:#818cf8,fill:#eef2ff
    classDef frontend stroke:#2dd4bf,fill:#f0fdfa
    classDef backend stroke:#a78bfa,fill:#f5f3ff
    classDef database stroke:#fb923c,fill:#fff7ed
    classDef security stroke:#f87171,fill:#fef2f2
    
    class Employee,Manager,Admin userRole
    class Frontend,CDN,Browser frontend
    class SupabaseAPI,SupabaseRT,SupabaseEdge backend
    class PostgreSQL database
    class SupabaseAuth security
```

## Technology Choices & Rationale
- **React 19 + Vite**: Chosen for fast development, HMR, and optimal bundle sizes.
- **Supabase**: Chosen for speed of implementation. By providing Auth, a PostgreSQL database, and an auto-generated API in one package, it eliminates the need to build a custom Node.js/Express backend from scratch.
- **Tailwind CSS v4**: Utility-first CSS allows for rapid, consistent styling and easy responsiveness.
- **Recharts**: Lightweight and customizable charting library used for the Analytics dashboard.

## Cost Optimisation Strategy
- **Hosting**: The frontend can be hosted statically (e.g., on Vercel or Netlify) for free or at very low cost.
- **Database**: Supabase's generous free tier covers the entire scope of the hackathon, minimizing overhead.
- **API Calls**: Instead of making multiple calls for related data, we use Supabase's joined queries (e.g., fetching Goal Sheets + Goals + Achievements in a single request) to optimize network bandwidth and cost.