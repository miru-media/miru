// Adapted from https://github.com/bredele/lin-kernighan

// MIT License
//
// Copyright (c) 2025 Olivier Wietrich
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

/**
 * Calculates the total distance of a tour by summing distances between consecutive cities.
 * @param tour Array of city indices representing the tour order
 * @param distanceMatrix 2D array containing distances between all city pairs
 * @returns Total distance of the tour
 */

const calculateTourDistance = (tour: number[], distanceMatrix: ArrayLike<number>[]): number => {
  let totalDistance = 0
  for (let i = 0; i < tour.length; i++) {
    const from = tour[i]
    const to = tour[(i + 1) % tour.length]
    totalDistance += distanceMatrix[from][to]
  }
  return totalDistance
}

/**
 * Generates an initial tour using the nearest neighbor heuristic.
 * Starts from city 0 and always visits the nearest unvisited city next.
 * @param distanceMatrix 2D array containing distances between all city pairs
 * @returns Array of city indices representing the initial tour
 */

const nearestNeighborTour = (distanceMatrix: ArrayLike<number>[]): number[] => {
  const n = distanceMatrix.length
  const visited = new Array<boolean>(n).fill(false)
  const tour = [0]
  visited[0] = true

  for (let i = 1; i < n; i++) {
    let nearest = -1
    let minDistance = Infinity

    for (let j = 0; j < n; j++) {
      if (!visited[j] && distanceMatrix[tour[tour.length - 1]][j] < minDistance) {
        minDistance = distanceMatrix[tour[tour.length - 1]][j]
        nearest = j
      }
    }

    tour.push(nearest)
    visited[nearest] = true
  }

  return tour
}

/**
 * Calculates the improvement delta for a 2-opt swap without performing it.
 * This avoids recalculating the entire tour distance.
 * @param tour Current tour as array of city indices
 * @param i Start position for the segment to reverse
 * @param k End position for the segment to reverse
 * @param distanceMatrix 2D array containing distances between all city pairs
 * @returns The change in tour distance (negative if improvement)
 */
const calculate2OptDelta = (
  tour: number[],
  i: number,
  k: number,
  distanceMatrix: ArrayLike<number>[],
): number => {
  const n = tour.length

  // Current edges that will be removed
  const edge1From = tour[i]
  const edge1To = tour[(i + 1) % n]
  const edge2From = tour[k]
  const edge2To = tour[(k + 1) % n]

  // New edges that will be added
  const newEdge1Distance = distanceMatrix[edge1From][edge2From]
  const newEdge2Distance = distanceMatrix[edge1To][edge2To]

  // Current edges that will be removed
  const oldEdge1Distance = distanceMatrix[edge1From][edge1To]
  const oldEdge2Distance = distanceMatrix[edge2From][edge2To]

  return newEdge1Distance + newEdge2Distance - (oldEdge1Distance + oldEdge2Distance)
}

/**
 * Performs a 2-opt swap by reversing the segment between two positions in-place.
 * This modifies the tour array directly to avoid memory allocations.
 * @param tour Current tour as array of city indices (modified in-place)
 * @param i Start position for the segment to reverse
 * @param k End position for the segment to reverse
 */
const twoOptSwapInPlace = (tour: number[], i: number, k: number): void => {
  // Reverse the segment between i+1 and k
  let left = i + 1
  let right = k

  while (left < right) {
    ;[tour[left], tour[right]] = [tour[right], tour[left]]
    left++
    right--
  }
}

/**
 * Implements the Lin-Kernighan algorithm to optimize the tour.
 * Uses 2-opt and 3-opt edge swapping to find better tour configurations.
 * @param tour Initial tour as array of city indices
 * @param distanceMatrix 2D array containing distances between all city pairs
 * @returns Optimized tour as array of city indices
 */

const linKernighan = (tour: number[], distanceMatrix: ArrayLike<number>[]): number[] => {
  const n = tour.length
  let bestTour = [...tour]
  let bestDistance = calculateTourDistance(bestTour, distanceMatrix)
  let improved = true

  while (improved) {
    improved = false

    // 2-opt improvements with delta calculation and early termination
    for (let i = 0; i < n - 1; i++) {
      for (let k = i + 1; k < n; k++) {
        const delta = calculate2OptDelta(bestTour, i, k, distanceMatrix)

        if (delta < 0) {
          // Apply the improvement in-place
          twoOptSwapInPlace(bestTour, i, k)
          bestDistance += delta
          improved = true
          break // Early termination - restart with improved tour
        }
      }
      if (improved) break // Break outer loop too
    }

    // 3-opt improvements (more complex edge swapping)
    if (!improved) {
      for (let i = 0; i < n - 2; i++) {
        for (let j = i + 1; j < n - 1; j++) {
          for (let k = j + 1; k < n; k++) {
            // Try different 3-opt reconnection patterns
            const segments = [
              bestTour.slice(0, i + 1),
              bestTour.slice(i + 1, j + 1),
              bestTour.slice(j + 1, k + 1),
              bestTour.slice(k + 1),
            ]

            // Pattern 1: reverse middle segment
            const option1 = [...segments[0], ...segments[1].reverse(), ...segments[2], ...segments[3]]

            // Pattern 2: reverse last segment
            const option2 = [...segments[0], ...segments[1], ...segments[2].reverse(), ...segments[3]]

            // Pattern 3: swap middle segments
            const option3 = [...segments[0], ...segments[2], ...segments[1], ...segments[3]]

            const options = [option1, option2, option3]

            /* eslint-disable max-depth -- -- */
            for (const option of options) {
              const distance = calculateTourDistance(option, distanceMatrix)
              if (distance < bestDistance) {
                bestTour = option
                bestDistance = distance
                improved = true
              }
            }
            /* eslint-enable max-depth */
          }
        }
      }
    }
  }

  return bestTour
}

/**
 * Solves the Traveling Salesman Problem using the Lin-Kernighan algorithm.
 * Takes a distance matrix and returns an optimized tour order of the source points.
 * @param distanceMatrix The distance matrix computed from the points
 * @param distanceFunc A function that calculates the distance between two points
 * @returns Array of indices of points in optimized tour order
 */

const tsp = (distanceMatrix: ArrayLike<number>[]): number[] => {
  if (distanceMatrix.length <= 1 || distanceMatrix.length === 2) {
    return distanceMatrix.map((_, i) => i)
  }

  // Generate initial tour using nearest neighbor heuristic
  let tour = nearestNeighborTour(distanceMatrix)
  // Optimize tour using Lin-Kernighan algorithm
  tour = linKernighan(tour, distanceMatrix)
  // Return point indices in optimized order
  return tour
}

export default tsp
