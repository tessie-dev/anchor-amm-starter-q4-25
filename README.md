## AMM Account Structure

```
User
 ├── user_x (user's token account for token X)
 ├── user_y (user's token account for token Y)
 └── user_lp (user’s share of the pool)

Pool
 ├── config (PDA) (Pool logic)
 ├── mint_lp (LP total supply)
 ├── vault_x (Pool’s token account holding token X)
 └── vault_y (Pool’s token account holding token Y)

System
 ├── token_program (Handle transfers/minting/burning)
 ├── associated_token_program
 └── system_program
```


| Account           | Owned By   |
| ----------------- | ---------- |
| user_x / user_y   | user       |
| user_lp           | user       |
| vault_x / vault_y | config PDA |
| mint_lp           | config PDA |

