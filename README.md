# SPARC - Spacetime Analysis and Radiative Transfer Code

SPARC is a web based GRRT code designed for simulating and visualizing accurate, physically-based simulations of gravitational lensing and other relativistic effects.

## Installation and Usage

To install SPARC, follow these steps:

1. Clone the repository:

```sh
git clone https://github.com/cadenmarinozzi/SPARC.git
cd SPARC
```

2. Install the dependencies:

```sh
npm install
```

3. Configure your simulation

Edit the configuration files in the `src/config` directory to set up your simulation parameters.

4. Start the reload watcher and server:

```sh
npm run watch & npm run dev
```

5. After the simulation is finished, download the frames and convert the output images to a video if desired:

```sh
node scripts/imagesToVideo.js <path_to_downloaded_frames> <output_video_path> <framerate>
```
