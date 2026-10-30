import { projects as portfolioProjects } from '../content.js';

const order = ['game', 'immersive', 'heritage', 'capstone', 'boundaries'];
const descriptions = {
  game: 'Following, fetching and Galaga companion prototypes exploring coordinated support. The reproducible study build uses local game-state rules; participant evaluation is planned.',
  immersive: 'Spatial layout, lighting, projection and on-site system integration at Fengyuzhu, followed by a separate browser exploration of hand and body interaction.',
  heritage: 'Field survey, architectural drawing and digital reconstruction of historic buildings, developed as part of a Hebei University team.',
  capstone: 'Direct-detection baselines, reproducibility checks and disagreement analysis within an eight-person MSc capstone team.',
  boundaries: 'An earlier browser exploration of spatial previews and user control, alongside the broader personal AI research proposal.'
};

export const projects = order.map((id, index) => ({
  ...portfolioProjects.find(project => project.id === id),
  number: String(index + 1).padStart(2, '0'),
  lead: descriptions[id]
}));
