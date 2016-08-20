import Promise from 'bluebird'
import nodeGeocoder from 'node-geocoder'

export default function getLocation (locationString) {
  return new Promise(
    (resolve, reject) => {
      const isCoord = /^(\-?\d+\.\d+)?,\s*(\-?\d+\.\d+?)$/.test(locationString)

      if (isCoord) {
        const coords = locationString.split(',')
        const result = {
          latitude: parseFloat(coords[0]),
          longitude: parseFloat(coords[1]),
          altitude: 0
        }

        resolve(result)
      } else {
        const options = {
          provider: 'google'
        }

        const geocoder = nodeGeocoder(options)

        geocoder.geocode(locationString, (err, res) => {
          if (err) {
            reject(err)
          }
          const result = {
            latitude: res[0].latitude,
            longitude: res[0].longitude,
            altitude: 0
          }

          resolve(result)
        })
      }
    }
  )
}
