import { Card } from '../types';

export const CARD_REGISTRY: Record<string, Card> = {
  '53251824': {
    id: '53251824',
    name: 'Raidraptor - Vanishing Lanius',
    imageUrl: 'https://images.ygoprodeck.com/images/cards/53251824.jpg'
  },
  '83236601': {
    id: '83236601',
    name: 'Raidraptor - Tribute Lanius',
    imageUrl: 'https://images.ygoprodeck.com/images/cards/83236601.jpg'
  },
  '96345188': {
    id: '96345188',
    name: 'Raidraptor - Mimicry Lanius',
    imageUrl: 'https://images.ygoprodeck.com/images/cards/96345188.jpg'
  },
  '31314549': {
    id: '31314549',
    name: 'Raidraptor - Singing Lanius',
    imageUrl: 'https://images.ygoprodeck.com/images/cards/31314549.jpg'
  },
  '87321742': {
    id: '87321742',
    name: 'Raidraptor - Strangle Lanius',
    imageUrl: 'https://images.ygoprodeck.com/images/cards/87321742.jpg'
  },
  '08559793': {
    id: '08559793',
    name: 'Raidraptor - Nest',
    imageUrl: 'https://images.ygoprodeck.com/images/cards/08559793.jpg'
  },
  '23581825': {
    id: '23581825',
    name: 'Rank-Up-Magic Soul Shave Force',
    imageUrl: 'https://images.ygoprodeck.com/images/cards/23581825.jpg'
  },
  '73347079': {
    id: '73347079',
    name: 'Raidraptor - Force Strix',
    imageUrl: 'https://images.ygoprodeck.com/images/cards/73347079.jpg'
  },
  '08617563': {
    id: '08617563',
    name: 'Raidraptor - Brave Strix',
    imageUrl: 'https://images.ygoprodeck.com/images/cards/08617563.jpg'
  },
  '36429703': {
    id: '36429703',
    name: 'Raidraptor - Wise Strix',
    imageUrl: 'https://images.ygoprodeck.com/images/cards/36429703.jpg'
  },
  '96157835': {
    id: '96157835',
    name: 'Raidraptor - Arsenal Falcon',
    imageUrl: 'https://images.ygoprodeck.com/images/cards/96157835.jpg'
  },
  '59822133': {
    id: '59822133',
    name: 'Raidraptor - Rising Rebellion Falcon',
    imageUrl: 'https://images.ygoprodeck.com/images/cards/59822133.jpg'
  },
  '43047672': {
    id: '43047672',
    name: 'Raidraptor - Final Fortress Falcon',
    imageUrl: 'https://images.ygoprodeck.com/images/cards/43047672.jpg'
  },
  '21044178': {
    id: '21044178',
    name: 'Abyss Dweller',
    imageUrl: 'https://images.ygoprodeck.com/images/cards/21044178.jpg'
  },
  '90448279': {
    id: '90448279',
    name: 'Divine Arsenal AA-ZEUS - Sky Thunder',
    imageUrl: 'https://images.ygoprodeck.com/images/cards/90448279.jpg'
  },
  '26973555': {
    id: '26973555',
    name: 'Number F0: Utopic Draco Future',
    imageUrl: 'https://images.ygoprodeck.com/images/cards/26973555.jpg'
  }
};

export function getCardImageUrl(id: string): string {
  return `https://images.ygoprodeck.com/images/cards/${id}.jpg`;
}
