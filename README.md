# 🌍 AidChain - Blockchain-Based Aid Platform

A platform built on Sui blockchain for transparent, secure and auditable aid distribution during disasters and crisis situations.

## ✨ Features

### 🔒 **Escrow Security**
- Donations are safely locked in package
- Coordinator cannot access until delivery
- Donor can refund if not delivered
- Full transparency on blockchain

### 📦 **Package Management**
- Coordinators create aid packages
- Each package has unique ID
- Real-time status tracking
- Sui Explorer integration

### 💰 **Secure Donations**
- Wallet integration (Sui Wallet, Ethos etc.)
- Transaction verification
- Escrow status viewing
- Failed transactions auto-detected

### 👥 **Transparent Tracking**
- All transactions on blockchain
- Anyone can verify
- Coordinator panel management
- Delivery tracking

### ⛽ **Gas-Free Transactions (Enoki Sponsored)**
- Zero gas fee for users
- Sponsored by platform
- Hackathon bonus feature
- Seamless user experience

## 🚀 Quick Start

### Requirements
- Node.js 18+
- Sui CLI (for smart contract deployment)
- Sui Wallet browser extension

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Application will run at http://localhost:5173

### Backend Setup (for Sponsored Transactions)

```bash
cd backend
npm install
# Add your Enoki private key to .env
npm run dev
```

Backend runs on http://localhost:3001

### Smart Contract Deployment

```bash
cd contracts/aidchain
sui move build
sui client publish --gas-budget 100000000
```

After deployment:
1. Copy the Package ID
2. Find the Registry object ID
3. Update `frontend/src/config.ts`

## 📝 Usage

### As Coordinator

1. **Create Package**
   - Click "Create Package" in CoordinatorPanel
   - Enter description, location and target amount

2. **Monitor Donations**
   - Escrow status visible in active packages
   - 🔒 Locked: Not yet delivered
   - ✓ Released: Transferred to coordinator

3. **Deliver Package**
   - Click "Mark as Delivered"
   - Escrow is released

### As Donor

1. **Select Package**
   - View active packages on main page
   - Review package details

2. **Make Donation**
   - Enter donation amount (min: 0.001 SUI)
   - Connect wallet and confirm
   - Gas-free with sponsored transactions!

3. **Verify Escrow**
   - Click "View in Explorer" after donation
   - Check `locked_donation` field

### As Aid Recipient

1. **Register for Aid**
   - Fill out the registration form
   - Upload required documents (Residence, Income)
   - Documents stored on Walrus decentralized storage

2. **Wait for Verification**
   - NGO/DAO members review your application
   - Verification through DAO voting process

3. **Receive Aid**
   - Once verified, you can receive donations
   - Mark packages as received

## 🏗️ Project Structure

```
aidchain/
├── contracts/
│   └── aidchain/
│       ├── sources/
│       │   └── aidchain.move      # Smart contract
│       └── Move.toml
├── frontend/
│   ├── src/
│   │   ├── DonationApp.tsx        # Main donation screen
│   │   ├── CoordinatorPanel.tsx   # Coordinator panel
│   │   ├── DonationForm.tsx       # Donation form
│   │   ├── DAOPanel.tsx           # DAO voting panel
│   │   ├── Dashboard.tsx          # Statistics dashboard
│   │   ├── RecipientRegistration.tsx # Aid application
│   │   ├── RecipientList.tsx      # Recipients list
│   │   ├── VerifierManagement.tsx # DAO member management
│   │   ├── useSponsoredTransaction.ts # Gas-free hook
│   │   ├── buildDonateTx.ts       # Transaction builder
│   │   ├── config.ts              # Blockchain config
│   │   └── style.css              # UI design
│   └── index.html
├── backend/
│   ├── server.js                  # Enoki sponsor proxy
│   └── .env                       # Private API key
└── README.md
```

## 🔧 Technologies

### Frontend
- **React 19.2.0**: Modern UI framework
- **TypeScript 5.9.3**: Type-safe development
- **Vite 7.2.4**: Lightning-fast build tool
- **@mysten/dapp-kit 0.19.9**: Sui wallet integration
- **@mysten/sui 1.45.0**: Sui SDK

### Backend
- **Express.js**: API server
- **@mysten/enoki**: Sponsored transactions

### Blockchain
- **Sui Blockchain**: High-performance L1
- **Move Language**: Safe smart contracts
- **Testnet**: Development and testing

### Storage
- **Walrus**: Decentralized document storage

### Design
- CSS Variables
- Inter Font Family
- Gradient Backgrounds
- Glassmorphism Effects
- Responsive Grid

## 🛡️ Security

### Smart Contract Security
- ✅ Escrow pattern for donation locking
- ✅ Conditional release (delivery required)
- ✅ Refund mechanism
- ✅ Access control (coordinator permissions)
- ✅ DAO-based verification

### Frontend Security
- ✅ Transaction effects validation
- ✅ Balance checking
- ✅ Error handling
- ✅ User feedback

### Verification
```bash
# Smart contract test
cd contracts/aidchain
sui move test

# Frontend build check
cd frontend
npm run build
```

## 📊 Deployed Instances

### Testnet (V10 - Latest)
- **Package ID**: `0x1157d993f30167c9d5552d61d5a0e838871f6fe3b1e36312beeb5b8825891ce1`
- **Registry ID**: `0x5763027400406393cc10ae18707cb9b9e087ddf618f550db57fc924474608e49`
- **Network**: Sui Testnet
- **Explorer**: https://testnet.suivision.xyz/

### Sponsor Address (Enoki)
- **Address**: `0x0dec4c7d041b07e655637e0dd0f9010bd7701f7613c66894d898795a54431290`

## 🎯 Hackathon Features

- ✅ **Sui Blockchain Integration** - Smart contracts in Move
- ✅ **Enoki Sponsored Gas** - Gas-free user experience
- ✅ **Walrus Storage** - Decentralized document storage
- ✅ **DAO Governance** - Decentralized verification voting
- ✅ **Escrow System** - Secure fund management
- ✅ **Modern UI/UX** - Clean, responsive design

## 📄 License

MIT License - see LICENSE file for details.
