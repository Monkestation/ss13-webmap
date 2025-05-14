import Fastify from 'fastify';
import pointOfView from '@fastify/view';
import fastifyStatic from '@fastify/static';
import { Liquid } from 'liquidjs';
import path from 'node:path';

const app = Fastify({ logger: true });

app.register(fastifyStatic, {
  root: path.join(process.cwd(), 'public'),
  prefix: '/public/',
});

const engine = new Liquid({
  root: path.join(process.cwd(), 'views'),
  extname: '.liquid',
});

app.register(pointOfView, {
  engine: {
    liquid: engine,
  },
  root: path.join(process.cwd(), 'views'),
  viewExt: 'liquid',
  defaultContext: {

  }
});

app.get('/', async (request, reply) => {
  reply.view("index.liquid", {
  categories: [
    {
      name: "In Rotation",
      logo: "/img/Logos/monke.png",
      maps: [
        { name: "Meta Station", url: "Monke/MetaStation/" },
        { name: "Delta Station", url: "Monke/DeltaStation/" },
      ]
    },
    {
      name: "Out of Rotation",
      logo: "/img/Logos/monke.png",
      maps: [
        { name: "Ouroboros", url: "Monke/Ouroboros/" },
        { name: "Oshan (WIP)", url: "Monke/Oshan/" }
      ]
    },
    {
      name: "Vanderlin",
      logo: "/img/Logos/tg_32.png",
      maps: [
        { name: "Vanderlin", url: "Vanderlin/vanderlin" },
        { name: "Vanderlin Bog", url: "Vanderlin/vanderlin_bog" },
        { name: "Vanderlin Forest", url: "Vanderlin/vanderlin_forest" },
        { name: "Vanderlin Mountains", url: "Vanderlin/vanderlin_mountain" }
      ]
    }
  ]
});

});

app.listen({ port: 3000 }, (err, address) => {
  if (err) throw err;
  console.log(`Server running at ${address}`);
});
