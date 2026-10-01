import { studionet } from 'genlayer-js/chains'

export const CONTRACT_ADDRESS = '0xB47fA3bA69E42ef362232C3bBF227588FC78eC5B' as const
export const EXPLORER_BASE = 'https://explorer-studio.genlayer.com'
export const STUDIO_CHAIN_ID = 61999
export const STUDIO_CHAIN_HEX = '0xf22f'
export const DIRECT_RPC = 'https://studio.genlayer.com/api'
export const PROXY_RPC = '/genlayer-rpc'

export const proxiedStudioNet = {
  ...studionet,
  rpcUrls: {
    ...studionet.rpcUrls,
    default: { http: [PROXY_RPC] },
  },
  blockExplorers: {
    default: { name: 'GenLayer Studio Explorer', url: EXPLORER_BASE },
  },
}

export const STUDIO_CHAIN_PARAMS = {
  chainId: STUDIO_CHAIN_HEX,
  chainName: 'GenLayer Studio Network',
  rpcUrls: [DIRECT_RPC],
  nativeCurrency: { name: 'GEN Token', symbol: 'GEN', decimals: 18 },
  blockExplorerUrls: [EXPLORER_BASE],
}

export const RECENT_IDS_KEY = `whichway:${CONTRACT_ADDRESS.toLowerCase()}:recent`
