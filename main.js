import Promise from 'bluebird'
import request from 'request'
import minimist from 'minimist'
import Farmer from './Farmer'
import credentials from './credentials.json'

const { username, password, provider } = credentials

const argv = minimist(process.argv.slice(2))
if (typeof(argv.l) !== "string") {
  console.log("Location must be provided after -l flag")
  process.exit(1)
}

const ballNames = ["Poke Ball", "Great Ball", "Ultra ball"]
const pokeballFlag = argv.b || 1
let pokeballType = argv.b || 1
console.log("Using %s", ballNames[pokeballType - 1])

const locationString = argv.l
let targetIds = {}

const farmer = new Farmer(334, 7500)
farmer.login(username, password, locationString, provider)

setInterval(() => {
  request('http://pokesnipers.com/api/v1/pokemon.json', (err, res, body) => {
    if (!err && res.statusCode === 200) {
      const json = JSON.parse(body)
      let newTargets = json.results.map((pokemon) => {
        const regex = /\/(\d+).\w+$/
        const found = pokemon.icon.match(regex)
        const coords = packCoordsString(pokemon.coords)
        return {
          id: pokemon.id,
          name: pokemon.name,
          indexID: parseInt(found[1]),
          coords: coords,
          until: new Date(pokemon.until).getTime()
        }
      })
      newTargets = newTargets.filter(target => {
        const isFresh = targetIds[target.id] === undefined
        targetIds[target.id] = true
        return isFresh
      })
      farmer.addNewTargets(newTargets)

    } else {
      console.log('Pokesnipers ERR')
    }
  })
}, 10000)

function packCoordsString (coordsString) {
  const coords = coordsString.split(',')
  return {
      type: 'coords',
      coords: {
        latitude: parseFloat(coords[0]),
        longitude: parseFloat(coords[1])
      }
  }
}
