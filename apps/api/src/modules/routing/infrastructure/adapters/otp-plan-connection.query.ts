/**
 * Consulta da API GraphQL GTFS do OpenTripPlanner 2.10 (`POST <OTP_URL>/otp/gtfs/v1`).
 *
 * Usa `planConnection` (estável desde a 2.6; `plan` está obsoleto na 2.10). Os modos ficam no
 * padrão do OTP: caminhada no acesso, na saída e nas baldeações, e todo modo de transporte.
 * `dateTime` é `{ earliestDeparture }` ou `{ latestArrival }`; sem ele, o OTP parte agora.
 * Tempos de trecho vêm de `start`/`end` (LegTime), com a previsão em tempo real em `estimated`.
 */
export const OTP_PLAN_CONNECTION_QUERY = /* GraphQL */ `
  query PlanTrip(
    $origin: PlanLabeledLocationInput!
    $destination: PlanLabeledLocationInput!
    $dateTime: PlanDateTimeInput
    $first: Int
  ) {
    planConnection(origin: $origin, destination: $destination, dateTime: $dateTime, first: $first) {
      routingErrors {
        code
        description
      }
      edges {
        node {
          start
          end
          duration
          walkDistance
          numberOfTransfers
          legs {
            mode
            transitLeg
            realTime
            duration
            distance
            headsign
            start {
              scheduledTime
              estimated {
                time
              }
            }
            end {
              scheduledTime
              estimated {
                time
              }
            }
            from {
              name
              lat
              lon
              stop {
                gtfsId
              }
            }
            to {
              name
              lat
              lon
              stop {
                gtfsId
              }
            }
            route {
              gtfsId
              shortName
              longName
              color
            }
            intermediateStops {
              gtfsId
            }
            legGeometry {
              points
            }
          }
        }
      }
    }
  }
`;
