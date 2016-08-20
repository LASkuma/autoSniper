import PokemonGO from 'pokemon-go-node-api'
import getLocation from './utils/getLocation'

export default class Farmer {
  constructor (apiThrottling, hbThrottling) {
    this.trainer = new PokemonGO.Pokeio()
    this.apiThrottling = apiThrottling
    this.heartbeatThrottling = hbThrottling
    this.prevHeartbeatTime = new Date().getTime()
    this.prevApiCallTime = new Date().getTime()
    this.queue = {
      line: [],
      inProgress: false
    }
    this.targets = []
  }

  login (username, password, location, provider) {
    let commands = []
    getLocation(location)
      .then(packAPICoords)
      .then((location) => {
        this.home = location
        commands.push({ executor: buildExecutor(this.trainer.init, [username, password, location, provider]) })
        commands.push({ executor: buildExecutor(this.trainer.GetProfile, []) })
        this.addNewCommands(commands)
      })
  }

  addNewCommands (newCommands) {
    this.queue.line = this.queue.line.concat(newCommands)
    if (!this.queue.inProgress) {
      this.queue.inProgress = true
      setImmediate(() => this.doNext())
    }
  }

  addNewTargets (newTargets) {
    this.targets = this.targets.concat(newTargets)
    if (!this.queue.inProgress) {
      setImmediate(() => this.catchTargets())
    }
  }

  catchTargets () {
    this.targets = this.targets.filter((target) => {
      const now = new Date().getTime()
      return target.until > now + 60000
    })
    this.target = this.targets.shift()
    if (this.target) {
      console.log('Catching ' + this.target.name)
      console.log('Teleporting')
      this.trainer.SetLocation(this.target.coords, (err) => {
        if (err) {
          console.log(err)
        }
        let commands = []
        commands.push({
          executor: buildExecutor(this.trainer.Heartbeat, []),
          then: this.getTargetPokemon.bind(this),
          type: 'hb'
        })
        this.addNewCommands(commands)
      })
    }
  }

  getTargetPokemon (hb) {
    for (var i = hb.cells.length - 1; i >= 0; i--) {
      if(hb.cells[i].WildPokemon[0]) {
        for (var x = hb.cells[i].WildPokemon.length - 1; x >= 0; x--) {
          const currentPokemon = hb.cells[i].WildPokemon[x]
          var pokeid = parseInt(currentPokemon.pokemon.PokemonId)
          console.log("Nearby is " + pokeid)
          if (this.target.indexID === pokeid) {
            let commands = []
            commands.push({
              executor: buildExecutor(this.trainer.EncounterPokemon, [currentPokemon]),
              then: this.goHome(currentPokemon)
            })
            this.addNewCommands(commands)
            return
          }
        }
      }
    }
    this.catchTargets()
  }

  goHome (currentPokemon) {
    return () => {
      this.trainer.SetLocation(this.home, (err) => {
        if (err) {
          console.log(err)
        }
        let commands = []
        commands.push({
          executor: buildExecutor(this.trainer.CatchPokemon, [currentPokemon, 1, 1.950, 1, 1]),
          then: this.catchLoop(currentPokemon)
        })
        this.addNewCommands(commands)
      })
    }
  }

  catchLoop (currentPokemon) {
    return (result) => {
      if (result.Status === 2) {
        let commands = []
        commands.push({
          executor: buildExecutor(this.trainer.CatchPokemon, [currentPokemon, 1, 1.950, 1, 1]),
          then: this.catchLoop(currentPokemon)
        })
        this.addNewCommands(commands)
        console.log('Dodged, try agin')
      } else if (result.Status === 1 || result.Status === 3) {
        if (result.Status === 1) {
          console.log('Caught')
        } else {
          console.log('Flee')
        }
        this.catchTargets()
      }
    }
  }

  doNext () {
    const command = this.queue.line.shift()
    if (command) {
      const wait = this.getWaitTime(command)

      setTimeout(() => {
        this.prevApiCallTime = new Date().getTime()
        if (command.type === 'hb') {
          this.prevHeartbeatTime = this.prevApiCallTime
        }
        this.runCommand(command).then(() => {
          setImmediate(() => this.doNext())
        })
      }, wait)
    } else {
      this.queue.inProgress = false
    }
  }

  runCommand ({ executor, then }) {
    return new Promise(executor).then(then)
  }

  getWaitTime (command) {
    const apiWait = this.prevApiCallTime + this.apiThrottling - new Date().getTime()
    if (command.type === 'hb') {
      const hbWait = this.prevHeartbeatTime + this.heartbeatThrottling - new Date().getTime()
      return apiWait < hbWait ? hbWait : apiWait
    }
    return apiWait
  }

}

function packAPICoords ({ latitude, longitude }) {
  return {
      type: 'coords',
      coords: {
        latitude: latitude,
        longitude: longitude
      }
  }
}

function buildExecutor (func, args) {
  return (resolve, reject) => {
    func(...args, (err, result) => {
      if (err) {
        return reject(err)
      }
      resolve(result)
    })
  }
}
