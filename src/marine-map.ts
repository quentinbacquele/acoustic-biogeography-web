import './index.css';
import { OptimizedDataLoader } from './optimized-loader';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as d3 from 'd3';

// Define the structure for the data points we will use
interface GridData {
    grid_id: string;
    ses_mean_prob_0: number;
    ses_mean_prob_1: number;
    ses_mean_prob_2: number;
    ses_mean_prob_3: number;
    ses_mean_prob_4: number;
    ses_mean_prob_5: number;
    ses_mean_prob_6: number;
    ses_mean_prob_7: number;
    ECO_NAME?: string;
}

interface TraitsData {
    'UMAP3D 1': number;
    'UMAP3D 2': number;
    'UMAP3D 3': number;
    species: string;
    family: string;
    prob_0: number;
    prob_1: number;
    prob_2: number;
    prob_3: number;
    prob_4: number;
    prob_5: number;
    prob_6: number;
    prob_7: number;
}

const strategyColors: { [key: string]: string } = {
    'Flat Whistles': '#785EF0',
    'Slow Trills': '#E69F00',
    'Fast Trills': '#009E73',
    'Ultrafast Trills': '#0072B2',
    'Slow Mod. Whistles': '#D55E00',
    'Fast Mod. Whistles': '#CC79A7',
    'Harmonic Stacks': '#444444',
    'Chaotic Notes': '#e1d314'
};

const strategyNames: { [key: number]: string } = {
    0: 'Flat Whistles',
    1: 'Slow Trills',
    2: 'Fast Trills',
    3: 'Chaotic Notes',
    4: 'Ultrafast Trills',
    5: 'Slow Mod. Whistles',
    6: 'Fast Mod. Whistles',
    7: 'Harmonic Stacks'
};

const DEFAULT_AUTO_PILOT_DIRECTION = new THREE.Vector3(0.62, 0.78, 0.45).normalize();
const DEFAULT_AUTO_PILOT_DISTANCE = 520;

const CUSTOM_PALETTE = [
    // Base colors from seaborn deep
    "#4C72B0", "#DD8452", "#55A868", "#C44E52", "#8172B3", 
    "#937860", "#DA8BC3", "#8C8C8C", "#CCB974", "#64B5CD",

    // Seaborn deep variations with different brightness
    "#2A4B8C", "#B85C21", "#2D7A3A", "#9C2226", "#584A94",
    "#6A513C", "#B455A0", "#595959", "#A79441", "#3B8CA3",

    // More variations with adjusted saturation
    "#1F3769", "#8C3C0F", "#1B5C25", "#771A1D", "#3A2D75",
    "#4C3621", "#8C3B7B", "#404040", "#826E2A", "#256A7D",

    // Additional colors with high contrast
    "#FF7F0E", "#2CA02C", "#D62728", "#9467BD", "#8C564B",
    "#E377C2", "#7F7F7F", "#BCBD22", "#17BECF", "#1F77B4",

    // Extended palette with bright variations
    "#FF9E4A", "#6ECC6E", "#FF6B6B", "#C49CFF", "#D49B8A",
    "#FF9EE2", "#BCBCBC", "#EAEA5C", "#5CDADA", "#5C9EFF",

    // Muted variations
    "#A66A2E", "#477A47", "#A64D4D", "#7A5C9E", "#8C6E63",
    "#B75C9E", "#666666", "#999936", "#368F8F", "#366A9E",
    
    // More muted earth tones
    "#8B4513", "#556B2F", "#8B0000", "#483D8B", "#A0522D",
    "#800080", "#696969", "#808000", "#008B8B", "#4682B4",

    // Additional bright tones
    "#FFA07A", "#98FB98", "#FA8072", "#DDA0DD", "#F4A460",
    "#FF69B4", "#D3D3D3", "#F0E68C", "#E0FFFF", "#87CEEB",

    // Deep rich tones
    "#CD853F", "#228B22", "#DC143C", "#4B0082", "#D2691E",
    "#BA55D3", "#A9A9A9", "#DAA520", "#20B2AA", "#4169E1",

    // Pastel variations
    "#FFB6C1", "#98FB98", "#FFA07A", "#E6E6FA", "#F0E68C",
    "#DDA0DD", "#B8B8B8", "#EEE8AA", "#AFEEEE", "#B0C4DE",

    // Final set of distinct colors
    "#FF4500", "#32CD32", "#FF1493", "#9370DB", "#FF8C00",
    "#8A2BE2", "#808080", "#BDB76B", "#48D1CC", "#0000CD"
];

class AcousticSpace {
    private container: HTMLElement;
    private scene: THREE.Scene | null = null;
    private camera: THREE.PerspectiveCamera | null = null;
    private renderer: THREE.WebGLRenderer | null = null;
    private controls: OrbitControls | null = null;
    private centeredTraitsData: Array<{species: TraitsData, position: THREE.Vector3, color: THREE.Color, opacity: number}> = [];
    private rawData: TraitsData[] = [];
    private animationFrameId: number | null = null;
    private raycaster: THREE.Raycaster = new THREE.Raycaster();
    private mouse: THREE.Vector2 = new THREE.Vector2();
    private tooltip: HTMLElement | null = null;
    private instancedMesh: THREE.InstancedMesh | null = null;
    private colorMode: 'family' | 'syndrome' | 'species' = 'family';
    private selectedFamily: string | null = null; // For family filtering
    private selectedSpecies: string | null = null;
    private activeSyndromeFilter: number | null = null;
    private familyColorScale: d3.ScaleOrdinal<string, string, never> = d3.scaleOrdinal(CUSTOM_PALETTE);
    private globalSpeciesColorScale: d3.ScaleOrdinal<string, string, never> | null = null;
    private currentFamilySpecies: Array<{species: string, color: string}> = [];
    private speciesFamilyMap: Map<string, string> = new Map();
    private speciesByFamilyMap: Map<string, string[]> = new Map();
    private allSpeciesEntries: Array<{species: string, family: string}> = [];
    private orderedFamilies: string[] = [];

    // Auto-pilot properties
    private isAutoPilotActive: boolean = false;
    private autoPilotTargets: Array<{
        position: THREE.Vector3;
        species: TraitsData;
        expectedSyndrome: number;
        actualSyndrome: number;
        audioFile: string;
        probability: number;
        sequenceIndex: number;
    }> = [];
    private currentTargetIndex: number = 0;
    private originalCameraPosition: THREE.Vector3 = new THREE.Vector3();
    private originalControlsTarget: THREE.Vector3 = new THREE.Vector3();
    private highlightSphere: THREE.Mesh | null = null;
    private currentAudio: HTMLAudioElement | null = null;
    private spectrogramPanel: HTMLElement | null = null;
    private spectrogramImage: HTMLImageElement | null = null;
    private controlStatesBeforeAutoPilot: { enablePan: boolean; enableRotate: boolean; enableZoom: boolean } | null = null;
    private autoPilotCameraDirection: THREE.Vector3 = DEFAULT_AUTO_PILOT_DIRECTION.clone();
    private autoPilotCameraDistance: number = DEFAULT_AUTO_PILOT_DISTANCE;
    private autoPilotStateListener: ((active: boolean) => void) | null = null;
    private autoPilotOrbitSpeed: number = 0.18; // radians per second
    private autoPilotOrbitVerticalAmplitude: number = 18;
    private autoPilotOrbitDistanceJitter: number = 0.06;
    private autoPilotOrbitUpAxis: THREE.Vector3 = new THREE.Vector3(0, 1, 0);
    private autoPilotSceneCenter: THREE.Vector3 = new THREE.Vector3();
    private autoPilotFocusLerp: number = 0.02;
    private autoPilotFocusWeight: number = 0.55;
    private currentAutoPilotFocus: THREE.Vector3 = new THREE.Vector3();
    private desiredAutoPilotFocus: THREE.Vector3 = new THREE.Vector3();
    private lastAutoPilotFocus: THREE.Vector3 = new THREE.Vector3();
    private autoPilotDriftDirection: THREE.Vector3 = new THREE.Vector3();
    private autoPilotMinorRotationFactor: number = 0.22;
    private autoPilotInterSampleDelay: number = 4000; // Minimum pause between samples (ms)
    private autoPilotNextTargetTimeout: number | null = null;
    private autoPilotOrbitAngle: number = 0;
    private currentCameraOrbitDirection: THREE.Vector3 = DEFAULT_AUTO_PILOT_DIRECTION.clone();
    private lastAutoPilotUpdateTime: number = 0;
    private readonly autoPilotSamplesPerSyndrome: number = 3;
    private readonly autoPilotPlaybackOrder: number[] = [0, 5, 6, 1, 2, 4, 7, 3];

    // Predefined autopilot species from autopilot_selected_species.txt
    // Ordered by syndrome following the acoustic space legend order (0,1,2,3,4,5,6,7)
    private autoPilotSpeciesList: Array<{ species: string; file: string; expectedSyndrome: number }> = [
        // WHISTLES — slow to fast (0 → 5 → 6)
        { species: 'Procnias_albus', file: 'Procnias_albus_20095_seg3.wav', expectedSyndrome: 0 },
        { species: 'Malaconotus_blanchoti', file: 'Malaconotus_blanchoti_306024_seg1.wav', expectedSyndrome: 0 },
        { species: 'Laniarius_major', file: 'Laniarius_major_339236_seg6.wav', expectedSyndrome: 0 },
        { species: 'Dryoscopus_cubla', file: 'Dryoscopus_cubla_339151_seg3.wav', expectedSyndrome: 5 },
        { species: 'Remiz_pendulinus', file: 'Remiz_pendulinus_646280_seg1.wav', expectedSyndrome: 5 },
        { species: 'Sitta_carolinensis', file: 'Sitta_carolinensis_665811_seg5.wav', expectedSyndrome: 5 },
        { species: 'Diglossa_gloriosissima', file: 'Diglossa_gloriosissima_10762_seg10.wav', expectedSyndrome: 6 },
        { species: 'Leiothlypis_ruficapilla', file: 'Leiothlypis_ruficapilla_814909_seg1.wav', expectedSyndrome: 6 },
        { species: 'Carpodacus_sibiricus', file: 'Carpodacus_sibiricus_405217_seg12.wav', expectedSyndrome: 6 },

        // TRILLS — slow to ultra-fast (1 → 2 → 4)
        { species: 'Hylophilus_flavipes', file: 'Hylophilus_flavipes_589653_seg1.wav', expectedSyndrome: 1 },
        { species: 'Hylophilus_semicinereus', file: 'Hylophilus_semicinereus_211170_seg2.wav', expectedSyndrome: 1 },
        { species: 'Paradisaea_minor', file: 'Paradisaea_minor_631658_seg4.wav', expectedSyndrome: 1 },
        { species: 'Cyanoderma_bicolor', file: 'Cyanoderma_bicolor_177178_seg3.wav', expectedSyndrome: 2 },
        { species: 'Drymophila_devillei', file: 'Drymophila_devillei_37938_seg6.wav', expectedSyndrome: 2 },
        { species: 'Synallaxis_albigularis', file: 'Synallaxis_albigularis_6595_seg3.wav', expectedSyndrome: 2 },
        { species: 'Scytalopus_griseicollis', file: 'Scytalopus_griseicollis_356569_seg2.wav', expectedSyndrome: 4 },
        { species: 'Ampelornis_griseiceps', file: 'Ampelornis_griseiceps_210292_seg10.wav', expectedSyndrome: 4 },
        { species: 'Ammodramus_aurifrons', file: 'Ammodramus_aurifrons_926453_seg7.wav', expectedSyndrome: 4 },

        // HARMONIC STACKS (7)
        { species: 'Cercomacra_melanaria', file: 'Cercomacra_melanaria_116273_seg2.wav', expectedSyndrome: 7 },
        { species: 'Fringilla_montifringilla', file: 'Fringilla_montifringilla_430650_seg8.wav', expectedSyndrome: 7 },
        { species: 'Anthus_campestris', file: 'Anthus_campestris_641604_seg15.wav', expectedSyndrome: 7 },

        // CHAOTIC NOTES (3)
        { species: 'Phylloscopus_ibericus', file: 'Phylloscopus_ibericus_484748_seg1.wav', expectedSyndrome: 3 },
        { species: 'Phylloscopus_nitidus', file: 'Phylloscopus_nitidus_906818_seg1.wav', expectedSyndrome: 3 },
        { species: 'Leptopogon_amaurocephalus', file: 'Leptopogon_amaurocephalus_343224_seg1.wav', expectedSyndrome: 3 },
    ];

    constructor(containerId: string) {
        this.container = document.getElementById(containerId)!;
        this.spectrogramPanel = document.getElementById('spectrogram-panel');
        this.spectrogramImage = document.getElementById('spectrogram-image') as HTMLImageElement;
    }

    private init() {
        if (!this.container) return;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);

        this.camera = new THREE.PerspectiveCamera(75, this.container.clientWidth / this.container.clientHeight, 0.1, 10000);

        // Rotate camera by 70 degrees and position it
        const radius = 800;
        const angle = Math.PI * 70 / 180; // 70 degrees in radians
        this.camera.position.set(
            radius * Math.cos(angle),
            radius * Math.sin(angle),
            500
        );

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        
        this.container.innerHTML = '';
        this.container.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 50;
        this.controls.maxDistance = 1000;
        // Zoom will be controlled by our custom wheel handler

        // Add resize listener for acoustic space
        window.addEventListener('resize', this.handleResize.bind(this));

        const axesHelper = new THREE.AxesHelper(100);
        this.scene.add(axesHelper);

        this.createTooltip();
        this.setupEventListeners();
        this.createPointCloud();
        
        this.animate();
    }

    private buildSpeciesLookups(data: TraitsData[]) {
        this.speciesFamilyMap.clear();
        this.speciesByFamilyMap.clear();

        const familySet = new Set<string>();

        data.forEach(entry => {
            if (!entry.species || this.speciesFamilyMap.has(entry.species)) {
                return;
            }
            this.speciesFamilyMap.set(entry.species, entry.family);
            familySet.add(entry.family);
            if (!this.speciesByFamilyMap.has(entry.family)) {
                this.speciesByFamilyMap.set(entry.family, []);
            }
            this.speciesByFamilyMap.get(entry.family)!.push(entry.species);
        });

        this.speciesByFamilyMap.forEach(list => list.sort((a, b) => a.localeCompare(b)));
        this.allSpeciesEntries = Array.from(this.speciesFamilyMap.entries())
            .map(([species, family]) => ({ species, family }))
            .sort((a, b) => a.species.localeCompare(b.species));
        this.globalSpeciesColorScale = d3.scaleOrdinal(CUSTOM_PALETTE).domain(this.allSpeciesEntries.map(entry => entry.species));
        this.orderedFamilies = Array.from(familySet).sort((a, b) => a.localeCompare(b));
        this.familyColorScale.domain(this.orderedFamilies);
    }

    private preprocessData(data: TraitsData[]) {
        console.log("Raw data sample:", data.slice(0, 3));
        
        const validData = data.filter(d => {
            const hasCoords = d['UMAP3D 1'] != null && !isNaN(d['UMAP3D 1']) &&
                             d['UMAP3D 2'] != null && !isNaN(d['UMAP3D 2']) &&
                             d['UMAP3D 3'] != null && !isNaN(d['UMAP3D 3']);
            return hasCoords;
        });

        console.log(`Filtered ${validData.length} valid points out of ${data.length} total`);

        if (validData.length === 0) {
            console.error("No valid traits data for acoustic space. Sample data keys:", Object.keys(data[0] || {}));
            this.centeredTraitsData = [];
            return;
        }

        const umapX = validData.map(d => d['UMAP3D 1']);
        const umapY = validData.map(d => d['UMAP3D 2']);
        const umapZ = validData.map(d => d['UMAP3D 3']);

        const centerX = umapX.reduce((a, b) => a + b, 0) / umapX.length;
        const centerY = umapY.reduce((a, b) => a + b, 0) / umapY.length;
        const centerZ = umapZ.reduce((a, b) => a + b, 0) / umapZ.length;

        console.log(`UMAP center: (${centerX.toFixed(2)}, ${centerY.toFixed(2)}, ${centerZ.toFixed(2)})`);

        // Ensure color scales are initialized
        if (!this.globalSpeciesColorScale) {
            this.globalSpeciesColorScale = d3.scaleOrdinal(CUSTOM_PALETTE).domain(
                this.allSpeciesEntries.map(entry => entry.species)
            );
        }
        if (this.familyColorScale.domain().length === 0) {
            const fallbackFamilies = Array.from(new Set(validData.map(d => d.family))).sort((a, b) => a.localeCompare(b));
            this.familyColorScale.domain(fallbackFamilies);
            this.orderedFamilies = fallbackFamilies;
        }

        // Refresh the species list for the current family selection
        if (this.selectedFamily) {
            const familyData = validData.filter(d => d.family === this.selectedFamily);
            const uniqueSpecies = Array.from(new Set(familyData.map(d => d.species)));

            if (this.selectedSpecies && !uniqueSpecies.includes(this.selectedSpecies)) {
                this.selectedSpecies = null;
            }

            this.currentFamilySpecies = uniqueSpecies.map(species => ({
                species: species,
                color: this.globalSpeciesColorScale ? this.globalSpeciesColorScale(species) : '#ffffff'
            }));
        } else {
            this.currentFamilySpecies = [];
        }

        this.centeredTraitsData = validData.map(species => {
            const centeredX = (species['UMAP3D 1'] - centerX) * 50;
            const centeredY = (species['UMAP3D 2'] - centerY) * 50;
            const centeredZ = (species['UMAP3D 3'] - centerZ) * 50;

            // Choose color and opacity based on current mode
            let color: THREE.Color;
            let opacity = 0.85;
            const dominant = this.getDominantSyndrome(species);

            if (this.colorMode === 'syndrome') {
                const strategyName = strategyNames[dominant];
                color = new THREE.Color(strategyColors[strategyName]);
            } else if (this.colorMode === 'species') {
                const speciesColor = this.globalSpeciesColorScale
                    ? this.globalSpeciesColorScale(species.species)
                    : '#BA5A31';
                if (this.selectedSpecies) {
                    const isMatch = species.species === this.selectedSpecies;
                    const highlightColor = this.globalSpeciesColorScale
                        ? this.globalSpeciesColorScale(this.selectedSpecies)
                        : '#BA5A31';
                    color = new THREE.Color(isMatch ? highlightColor : speciesColor);
                    opacity = isMatch ? 1.0 : 0.0;
                } else {
                    color = new THREE.Color(speciesColor);
                }
            } else {
                const familyColor = this.familyColorScale(species.family);
                const shouldUseSpeciesColor = this.selectedFamily
                    && this.globalSpeciesColorScale
                    && species.family === this.selectedFamily;
                color = new THREE.Color(
                    shouldUseSpeciesColor ? this.globalSpeciesColorScale!(species.species) : familyColor
                );
            }

            const hasFilter = this.hasActiveFilters();
            let matchesFilter = true;
            if (this.colorMode === 'syndrome' && this.activeSyndromeFilter !== null) {
                matchesFilter = dominant === this.activeSyndromeFilter;
            } else if (this.colorMode === 'family' && this.selectedFamily) {
                matchesFilter = species.family === this.selectedFamily;
            } else if (this.colorMode === 'species' && this.selectedSpecies) {
                matchesFilter = species.species === this.selectedSpecies;
            }

            if (hasFilter && this.colorMode !== 'species') {
                opacity = matchesFilter ? 1.0 : 0.08;
            }

            return {
                species: species,
                position: new THREE.Vector3(centeredX, centeredY, centeredZ),
                color: color,
                opacity: opacity
            };
        });

        console.log(`Created ${this.centeredTraitsData.length} centered data points with ${this.colorMode} coloring`);
    }

    private createTooltip() {
        this.tooltip = document.createElement('div');
        this.tooltip.style.cssText = `
            position: fixed;
            display: none;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 10px 15px;
            border-radius: 8px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            pointer-events: none;
            z-index: 10000;
            border: 1px solid rgba(255, 255, 255, 0.2);
            max-width: 250px;
        `;
        document.body.appendChild(this.tooltip);
    }

    public setAutoPilotStateListener(listener: (active: boolean) => void) {
        this.autoPilotStateListener = listener;
    }

    private notifyAutoPilotState(active: boolean) {
        if (this.autoPilotStateListener) {
            this.autoPilotStateListener(active);
        }
    }

    private getCameraPositionForTarget(targetPosition: THREE.Vector3, directionOverride?: THREE.Vector3): THREE.Vector3 {
        const orbitDirection = (directionOverride
            ?? this.currentCameraOrbitDirection
            ?? this.autoPilotCameraDirection).clone().normalize();

        const distanceJitter = 1 + Math.sin(this.autoPilotOrbitAngle * 1.3) * this.autoPilotOrbitDistanceJitter;
        const desiredDistance = this.autoPilotCameraDistance * distanceJitter;
        const clampedDistance = Math.max(this.autoPilotCameraDistance * 0.85, desiredDistance);
        const verticalOffset = Math.sin(this.autoPilotOrbitAngle * 0.65) * this.autoPilotOrbitVerticalAmplitude;

        const cameraPos = targetPosition.clone().add(orbitDirection.multiplyScalar(clampedDistance));
        cameraPos.y += verticalOffset;
        return cameraPos;
    }

    private getFocusDirectionFromCenter(): THREE.Vector3 {
        const direction = this.currentAutoPilotFocus.clone().sub(this.autoPilotSceneCenter);
        if (direction.lengthSq() === 0) {
            return this.autoPilotCameraDirection.clone();
        }
        return direction.normalize();
    }

    private setupEventListeners() {
        if (!this.renderer) return;

        this.renderer.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.renderer.domElement.addEventListener('mouseleave', this.onMouseLeave.bind(this));
        this.renderer.domElement.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.renderer.domElement.addEventListener('mouseup', this.onMouseUp.bind(this));

        // Hide tooltip when page scrolls
        window.addEventListener('scroll', () => {
            this.hideTooltip();
        }, { passive: true });

        // Only allow zoom when Ctrl/Cmd is pressed to avoid interfering with page scroll
        this.renderer.domElement.addEventListener('wheel', (e: WheelEvent) => {
            if (!e.ctrlKey && !e.metaKey) {
                // Disable zoom when Ctrl/Cmd is not pressed, allow page scroll
                if (this.controls) {
                    this.controls.enableZoom = false;
                }
                // Don't stop propagation - let the scroll pass through
            } else {
                // Allow zoom when Ctrl/Cmd is pressed
                if (this.controls) {
                    this.controls.enableZoom = true;
                }
            }
        }, { passive: true });
    }

    private isDragging = false;

    private onMouseDown() {
        this.isDragging = true;
        this.hideTooltip();
    }

    private onMouseUp() {
        setTimeout(() => {
            this.isDragging = false;
        }, 100);
    }

    private onMouseMove(event: MouseEvent) {
        if (!this.camera || !this.scene || !this.instancedMesh || this.isDragging) return;

        const rect = this.renderer!.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.instancedMesh);

        if (intersects.length > 0 && intersects[0].instanceId !== undefined) {
            const instanceId = intersects[0].instanceId;
            if (instanceId < this.centeredTraitsData.length) {
                const data = this.centeredTraitsData[instanceId];
                this.showTooltip(event.clientX, event.clientY, data.species);
            }
        } else {
            this.hideTooltip();
        }
    }

    private onMouseLeave() {
        this.hideTooltip();
    }

    private showTooltip(x: number, y: number, speciesData: TraitsData) {
        if (!this.tooltip) return;

        // Format species name by replacing _ with space
        const formattedSpecies = (speciesData.species || 'Unknown').replace(/_/g, ' ');

        // Find dominant strategy
        const probs = [
            speciesData.prob_0, speciesData.prob_1, speciesData.prob_2, speciesData.prob_3,
            speciesData.prob_4, speciesData.prob_5, speciesData.prob_6, speciesData.prob_7
        ];
        const dominantStrategyNum = probs.indexOf(Math.max(...probs));
        const dominantStrategyName = strategyNames[dominantStrategyNum];
        const dominantProb = (probs[dominantStrategyNum] * 100).toFixed(1);

        this.tooltip.innerHTML = `
            <div><strong>Species:</strong> ${formattedSpecies}</div>
            <div><strong>Family:</strong> ${speciesData.family || 'Unknown'}</div>
            <div><strong>Dominant Motif:</strong> ${dominantStrategyName} (${dominantProb}%)</div>
        `;

        this.tooltip.style.display = 'block';
        this.tooltip.style.left = `${x + 15}px`;
        this.tooltip.style.top = `${y - 10}px`;
    }

    private hideTooltip() {
        if (this.tooltip) {
            this.tooltip.style.display = 'none';
        }
    }

    private handleResize() {
        if (!this.renderer || !this.camera || !this.container) return;
        
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }

    private createPointCloud() {
        if (!this.scene || this.centeredTraitsData.length === 0) {
            console.warn("Cannot create point cloud: scene or data missing");
            return;
        }

        console.log(`Creating InstancedMesh point cloud with ${this.centeredTraitsData.length} points`);

        // Clear any existing meshes
        if (this.instancedMesh) {
            this.scene.remove(this.instancedMesh);
            this.instancedMesh.geometry.dispose();
            if (this.instancedMesh.material instanceof THREE.Material) {
                this.instancedMesh.material.dispose();
            }
            this.instancedMesh = null;
        }

        // Create high-performance InstancedMesh like in the original
        const sphereGeom = new THREE.SphereGeometry(2.0, 8, 8);
        const mat = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 1.0
        });

        this.instancedMesh = new THREE.InstancedMesh(
            sphereGeom,
            mat,
            this.centeredTraitsData.length
        );
        this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        // Set colors and positions using the InstancedMesh API
        const color = new THREE.Color();
        const matrix = new THREE.Matrix4();

        const minVisibleScale = 0.9;
        const maxVisibleScale = 3.0;
        this.centeredTraitsData.forEach((item, i) => {
            // Set color for this instance
            color.copy(item.color);
            this.instancedMesh!.setColorAt(i, color);

            // Set position matrix for this instance with scale based on opacity
            // Hide points with prob < 0.5, otherwise map 0.5-1.0 range to chunkier dot sizes
            let scale;
            if (item.opacity < 0.5) {
                scale = 0.001; // Essentially invisible
            } else {
                // Normalize 0.5-1.0 to 0-1 so we can interpolate between our size bounds
                const normalizedProb = (item.opacity - 0.5) / 0.5;
                scale = minVisibleScale + normalizedProb * (maxVisibleScale - minVisibleScale);
            }
            matrix.compose(
                item.position,
                new THREE.Quaternion(),
                new THREE.Vector3(scale, scale, scale)
            );
            this.instancedMesh!.setMatrixAt(i, matrix);
        });

        // Update the instance attributes
        this.instancedMesh.instanceMatrix.needsUpdate = true;
        if (this.instancedMesh.instanceColor) {
            this.instancedMesh.instanceColor.needsUpdate = true;
        }

        this.scene.add(this.instancedMesh);
        console.log(`Added InstancedMesh with ${this.centeredTraitsData.length} instances to scene`);
    }

    public async loadData(data: TraitsData[]) {
        this.rawData = data;
        this.buildSpeciesLookups(data);
        this.preprocessData(data);
        if (this.scene) {
            this.createPointCloud();
        }
    }

    public setColorMode(mode: 'family' | 'syndrome' | 'species') {
        this.colorMode = mode;
        if (this.rawData.length > 0) {
            this.preprocessData(this.rawData);
            this.createPointCloud();
        }
    }

    public setSelectedFamily(family: string | null) {
        if (this.selectedFamily === family) {
            return;
        }
        this.selectedFamily = family;
        this.selectedSpecies = null;
        if (this.rawData.length > 0 && this.colorMode === 'family') {
            this.preprocessData(this.rawData);
            this.createPointCloud();
        }
    }

    public getAllFamilies(): string[] {
        if (this.orderedFamilies.length > 0) {
            return [...this.orderedFamilies];
        }
        const families = new Set<string>();
        this.rawData.forEach(d => families.add(d.family));
        this.orderedFamilies = Array.from(families).sort((a, b) => a.localeCompare(b));
        this.familyColorScale.domain(this.orderedFamilies);
        return [...this.orderedFamilies];
    }

    public getSelectedFamily(): string | null {
        return this.selectedFamily;
    }

    public getSpeciesForFamily(family: string): string[] {
        const species = this.speciesByFamilyMap.get(family);
        return species ? [...species] : [];
    }

    private getDominantSyndrome(species: TraitsData): number {
        const probs = [
            species.prob_0, species.prob_1, species.prob_2, species.prob_3,
            species.prob_4, species.prob_5, species.prob_6, species.prob_7
        ];
        let maxIndex = 0;
        let maxValue = probs[0];
        for (let i = 1; i < probs.length; i++) {
            if (probs[i] > maxValue) {
                maxValue = probs[i];
                maxIndex = i;
            }
        }
        return maxIndex;
    }

    public getAllSpeciesEntries(): Array<{species: string, family: string}> {
        return this.allSpeciesEntries;
    }

    public getFamilyForSpecies(species: string): string | null {
        return this.speciesFamilyMap.get(species) || null;
    }

    public setSelectedSpecies(species: string | null) {
        if (this.selectedSpecies === species) {
            return;
        }
        this.selectedSpecies = species;
        if (species) {
            this.selectedFamily = this.speciesFamilyMap.get(species) || null;
        }
        if (this.rawData.length > 0 && this.colorMode === 'species') {
            this.preprocessData(this.rawData);
            this.createPointCloud();
        }
    }

    public setSyndromeFilter(strategy: number | null) {
        if (this.activeSyndromeFilter === strategy) return;
        this.activeSyndromeFilter = strategy;
        if (this.rawData.length > 0 && this.colorMode === 'syndrome') {
            this.preprocessData(this.rawData);
            this.createPointCloud();
        }
    }

    public getSyndromeFilter(): number | null {
        return this.activeSyndromeFilter;
    }

    public getSelectedSpecies(): string | null {
        return this.selectedSpecies;
    }

    public getCurrentFamilySpecies(): Array<{species: string, color: string}> {
        return this.currentFamilySpecies;
    }

    public getFamilyLegendEntries(limit = 10): Array<{family: string, color: string}> {
        const availableFamilies = this.getAllFamilies();
        const entries = availableFamilies.map(family => ({
            family,
            color: this.familyColorScale(family)
        }));
        return limit > 0 ? entries.slice(0, limit) : entries;
    }

    public getSpeciesLegendEntries(limit = 8): Array<{species: string, label: string, color: string}> {
        if (!this.globalSpeciesColorScale) {
            return [];
        }
        const entries = this.allSpeciesEntries.slice(0, limit);
        return entries.map(entry => ({
            species: entry.species,
            label: this.formatSpeciesLabel(entry.species),
            color: this.globalSpeciesColorScale!(entry.species)
        }));
    }

    public getSpeciesColorInfo(species: string): {species: string, label: string, color: string} | null {
        if (!this.globalSpeciesColorScale) {
            return null;
        }
        return {
            species,
            label: this.formatSpeciesLabel(species),
            color: this.globalSpeciesColorScale(species)
        };
    }

    public getSpeciesCount(): number {
        return this.allSpeciesEntries.length;
    }

    private formatSpeciesLabel(species: string): string {
        return species.replace(/_/g, ' ');
    }

    public hasActiveFilters(): boolean {
        if (this.colorMode === 'syndrome') {
            return this.activeSyndromeFilter !== null;
        }
        if (this.colorMode === 'family') {
            return Boolean(this.selectedFamily);
        }
        if (this.colorMode === 'species') {
            return Boolean(this.selectedSpecies);
        }
        return false;
    }

    public isAutoPilotRunning(): boolean {
        return this.isAutoPilotActive;
    }

    /**
     * Find autopilot targets based on predefined species list from autopilot_selected_species.txt
     * Returns targets in the order defined in the species list
     */
    private findAutoPilotTargets(): Array<{
        position: THREE.Vector3;
        species: TraitsData;
        expectedSyndrome: number;
        actualSyndrome: number;
        audioFile: string;
        probability: number;
        sequenceIndex: number;
    }> {
        const buckets = new Map<number, Array<{
            position: THREE.Vector3;
            species: TraitsData;
            expectedSyndrome: number;
            actualSyndrome: number;
            audioFile: string;
            probability: number;
            sequenceIndex: number;
        }>>();

        // Build buckets keyed by actual syndrome while preserving authored order
        this.autoPilotSpeciesList.forEach((speciesEntry, index) => {
            const matchingItem = this.centeredTraitsData.find(
                item => item.species.species === speciesEntry.species
            );

            if (!matchingItem) {
                console.warn(`Could not find species ${speciesEntry.species} in acoustic space data`);
                return;
            }

            const probabilities = [
                matchingItem.species.prob_0,
                matchingItem.species.prob_1,
                matchingItem.species.prob_2,
                matchingItem.species.prob_3,
                matchingItem.species.prob_4,
                matchingItem.species.prob_5,
                matchingItem.species.prob_6,
                matchingItem.species.prob_7
            ];

            const maxProb = Math.max(...probabilities);
            const dominantIndex = probabilities.indexOf(maxProb);

            if (dominantIndex !== speciesEntry.expectedSyndrome) {
                console.warn(
                    `Auto-pilot mismatch for ${speciesEntry.species}: expected motif ${speciesEntry.expectedSyndrome} (${strategyNames[speciesEntry.expectedSyndrome]}) but data dominant is ${dominantIndex} (${strategyNames[dominantIndex]})`
                );
            }

            const target = {
                position: matchingItem.position.clone(),
                species: matchingItem.species,
                expectedSyndrome: speciesEntry.expectedSyndrome,
                actualSyndrome: dominantIndex,
                audioFile: `/sounds/${speciesEntry.file}`,
                probability: maxProb,
                sequenceIndex: index
            };

            if (!buckets.has(dominantIndex)) {
                buckets.set(dominantIndex, []);
            }

            buckets.get(dominantIndex)!.push(target);
        });

        const orderedTargets: typeof this.autoPilotTargets = [];

        this.autoPilotPlaybackOrder.forEach((syndromeIndex, orderPosition) => {
            const bucket = buckets.get(syndromeIndex);

            if (!bucket || bucket.length === 0) {
                console.warn(`No autopilot samples found for motif ${syndromeIndex} (${strategyNames[syndromeIndex]})`);
                return;
            }

            // Prioritise higher confidence samples but keep authored ordering as tiebreaker
            bucket.sort((a, b) => {
                if (b.probability !== a.probability) {
                    return b.probability - a.probability;
                }
                return a.sequenceIndex - b.sequenceIndex;
            });

            const limited = bucket.slice(0, this.autoPilotSamplesPerSyndrome);

            if (bucket.length < this.autoPilotSamplesPerSyndrome) {
                console.warn(`Motif ${syndromeIndex} (${strategyNames[syndromeIndex]}) only has ${bucket.length} autopilot samples (expected ${this.autoPilotSamplesPerSyndrome}).`);
            }

            orderedTargets.push(...limited);

            console.log(`Auto-pilot group ${orderPosition + 1}/${this.autoPilotPlaybackOrder.length}: ${strategyNames[syndromeIndex]} → ${limited.length} samples`);
        });

        console.log(`Prepared ${orderedTargets.length} auto-pilot targets from ${this.autoPilotSpeciesList.length} curated entries.`);
        return orderedTargets;
    }

    /**
     * Start auto-pilot navigation through top motif examples
     */
    public startAutoPilot(): boolean {
        if (this.isAutoPilotActive) {
            this.stopAutoPilot();
            return false;
        }

        if (this.hasActiveFilters()) {
            console.warn('Auto-pilot is unavailable while filtering by family or species.');
            this.notifyAutoPilotState(false);
            return false;
        }

        this.autoPilotTargets = this.findAutoPilotTargets();

        if (this.autoPilotTargets.length === 0) {
            console.warn('No auto-pilot targets found');
            this.notifyAutoPilotState(false);
            return false;
        }

        if (this.camera && this.controls) {
            this.originalCameraPosition.copy(this.camera.position);
            this.originalControlsTarget.copy(this.controls.target);
            this.controlStatesBeforeAutoPilot = {
                enablePan: this.controls.enablePan,
                enableRotate: this.controls.enableRotate,
                enableZoom: this.controls.enableZoom
            };
            this.controls.enablePan = false;
            this.controls.enableRotate = false;
            this.controls.enableZoom = false;
        }

        if (this.scene && !this.highlightSphere) {
            const geometry = new THREE.SphereGeometry(12, 20, 20);
            const material = new THREE.MeshBasicMaterial({
                color: 0xffff00,
                transparent: true,
                opacity: 0.55,
                wireframe: true
            });
            this.highlightSphere = new THREE.Mesh(geometry, material);
            this.scene.add(this.highlightSphere);
        }

        if (this.autoPilotNextTargetTimeout !== null) {
            window.clearTimeout(this.autoPilotNextTargetTimeout);
            this.autoPilotNextTargetTimeout = null;
        }

        this.autoPilotSceneCenter = this.computeAutoPilotSceneCenter();

        if (this.camera) {
            const offsetFromCenter = this.camera.position.clone().sub(this.autoPilotSceneCenter);
            const distanceFromCenter = offsetFromCenter.length();
            if (distanceFromCenter > 0) {
                const normalizedDirection = offsetFromCenter.clone().normalize();
                this.autoPilotCameraDistance = Math.max(DEFAULT_AUTO_PILOT_DISTANCE, distanceFromCenter);
                this.autoPilotCameraDirection.copy(normalizedDirection);
                this.currentCameraOrbitDirection.copy(normalizedDirection);
            } else {
                this.autoPilotCameraDistance = DEFAULT_AUTO_PILOT_DISTANCE;
                this.autoPilotCameraDirection.copy(DEFAULT_AUTO_PILOT_DIRECTION);
                this.currentCameraOrbitDirection.copy(DEFAULT_AUTO_PILOT_DIRECTION);
            }
        } else {
            this.autoPilotCameraDistance = DEFAULT_AUTO_PILOT_DISTANCE;
            this.autoPilotCameraDirection.copy(DEFAULT_AUTO_PILOT_DIRECTION);
            this.currentCameraOrbitDirection.copy(DEFAULT_AUTO_PILOT_DIRECTION);
        }

        this.autoPilotOrbitAngle = 0;
        this.lastAutoPilotUpdateTime = performance.now();

        this.isAutoPilotActive = true;
        this.currentTargetIndex = 0;

        const firstTarget = this.autoPilotTargets[0];
        if (firstTarget) {
            if (this.controls) {
                this.currentAutoPilotFocus.copy(this.controls.target);
            } else {
                this.currentAutoPilotFocus.copy(this.autoPilotSceneCenter);
            }
            const firstDirection = firstTarget.position.clone().sub(this.autoPilotSceneCenter);
            if (firstDirection.lengthSq() > 0) {
                firstDirection.normalize();
                this.currentCameraOrbitDirection.copy(firstDirection);
                this.autoPilotCameraDirection.copy(firstDirection);
            } else {
                this.currentCameraOrbitDirection.copy(DEFAULT_AUTO_PILOT_DIRECTION);
                this.autoPilotCameraDirection.copy(DEFAULT_AUTO_PILOT_DIRECTION);
            }
            this.desiredAutoPilotFocus.copy(firstTarget.position);
        } else {
            this.currentAutoPilotFocus.copy(this.autoPilotSceneCenter);
            this.desiredAutoPilotFocus.set(0, 0, 0);
            this.currentCameraOrbitDirection.copy(DEFAULT_AUTO_PILOT_DIRECTION);
            this.autoPilotCameraDirection.copy(DEFAULT_AUTO_PILOT_DIRECTION);
        }

        if (this.controls) {
            this.lastAutoPilotFocus.copy(this.controls.target);
        } else {
            this.lastAutoPilotFocus.copy(this.autoPilotSceneCenter);
        }
        this.autoPilotDriftDirection.set(0, 0, 0);

        this.notifyAutoPilotState(true);

        console.log(`Auto-pilot started with ${this.autoPilotTargets.length} targets`);

        this.startCurrentTargetPlayback();
        return true;
    }

    private computeAutoPilotSceneCenter(): THREE.Vector3 {
        if (this.centeredTraitsData.length === 0) {
            return new THREE.Vector3();
        }

        const center = new THREE.Vector3();
        this.centeredTraitsData.forEach(dataPoint => {
            center.add(dataPoint.position);
        });
        return center.divideScalar(this.centeredTraitsData.length);
    }

    private startCurrentTargetPlayback() {
        if (!this.isAutoPilotActive) return;
        const target = this.autoPilotTargets[this.currentTargetIndex];
        if (!target) return;
        if (this.lastAutoPilotFocus.lengthSq() > 0) {
            this.autoPilotDriftDirection.copy(target.position).sub(this.lastAutoPilotFocus);
            if (this.autoPilotDriftDirection.lengthSq() > 0) {
                this.autoPilotDriftDirection.normalize();
            }
        } else {
            this.autoPilotDriftDirection.set(0, 0, 0);
        }
        this.lastAutoPilotFocus.copy(target.position);
        this.desiredAutoPilotFocus.copy(target.position);
        if (this.currentAutoPilotFocus.lengthSq() === 0) {
            this.currentAutoPilotFocus.copy(target.position);
        }
        this.playTargetAudio(target.audioFile);
    }

    /**
     * Stop auto-pilot and return to original view
     */
    public stopAutoPilot() {
        this.isAutoPilotActive = false;

        // Stop any playing audio
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }

        // Hide spectrogram panel
        this.hideSpectrogram();

        if (this.autoPilotNextTargetTimeout !== null) {
            window.clearTimeout(this.autoPilotNextTargetTimeout);
            this.autoPilotNextTargetTimeout = null;
        }

        this.autoPilotOrbitAngle = 0;
        this.autoPilotCameraDirection.copy(DEFAULT_AUTO_PILOT_DIRECTION);
        this.currentCameraOrbitDirection.copy(DEFAULT_AUTO_PILOT_DIRECTION);
        this.autoPilotSceneCenter.set(0, 0, 0);
        this.lastAutoPilotUpdateTime = 0;
        this.autoPilotCameraDistance = DEFAULT_AUTO_PILOT_DISTANCE;
        this.currentAutoPilotFocus.set(0, 0, 0);
        this.desiredAutoPilotFocus.set(0, 0, 0);
        this.lastAutoPilotFocus.set(0, 0, 0);
        this.autoPilotDriftDirection.set(0, 0, 0);

        // Return to original position
        if (this.camera && this.controls) {
            this.camera.position.copy(this.originalCameraPosition);
            this.controls.target.copy(this.originalControlsTarget);
            if (this.controlStatesBeforeAutoPilot) {
                this.controls.enablePan = this.controlStatesBeforeAutoPilot.enablePan;
                this.controls.enableRotate = this.controlStatesBeforeAutoPilot.enableRotate;
                this.controls.enableZoom = this.controlStatesBeforeAutoPilot.enableZoom;
            } else {
                this.controls.enablePan = true;
                this.controls.enableRotate = true;
                this.controls.enableZoom = true;
            }
            this.controls.update();
        }
        this.controlStatesBeforeAutoPilot = null;

        // Remove highlight sphere
        if (this.highlightSphere && this.scene) {
            this.scene.remove(this.highlightSphere);
            this.highlightSphere.geometry.dispose();
            if (this.highlightSphere.material instanceof THREE.Material) {
                this.highlightSphere.material.dispose();
            }
            this.highlightSphere = null;
        }

        // Hide tooltip
        this.hideTooltip();

        this.autoPilotTargets = [];
        this.currentTargetIndex = 0;
        this.notifyAutoPilotState(false);

        console.log('Auto-pilot stopped');
    }

    /**
     * Play audio for the current target
     */
    private playTargetAudio(audioFile: string) {
        // Stop any currently playing audio
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }

        // Update spectrogram display
        this.updateSpectrogram(audioFile);

        // Create and load new audio
        this.currentAudio = new Audio(audioFile);

        // Handle audio events
        this.currentAudio.addEventListener('ended', () => {
            this.currentAudio = null;
            // Wait before moving to the next target so each sample has breathing room
            this.scheduleNextAutoPilotTarget();
        });

        this.currentAudio.addEventListener('error', (e) => {
            console.error(`Error loading audio file ${audioFile}:`, e);
            this.currentAudio = null;
            // Still advance, but respect the delay to avoid abrupt jumps
            this.scheduleNextAutoPilotTarget();
        });

        // Play the audio
        this.currentAudio.play().catch(err => {
            console.error('Error playing audio:', err);
            this.currentAudio = null;
            // Move on with the usual delay even if playback fails
            this.scheduleNextAutoPilotTarget();
        });

        console.log(`Playing audio: ${audioFile}`);
    }

    /**
     * Update the spectrogram display with the current audio file
     */
    private updateSpectrogram(audioFile: string) {
        if (!this.spectrogramImage || !this.spectrogramPanel) return;

        // Convert audio filename to spectrogram filename
        // /sounds/Species_name.wav -> /spectrograms/Species_name.png
        const spectrogramPath = audioFile.replace('/sounds/', '/spectrograms/').replace('.wav', '.png');

        this.spectrogramImage.src = spectrogramPath;
        this.spectrogramPanel.classList.add('visible');
    }

    /**
     * Hide the spectrogram panel
     */
    private hideSpectrogram() {
        if (this.spectrogramPanel) {
            this.spectrogramPanel.classList.remove('visible');
        }
    }

    /**
     * Schedule a move to the next autopilot target after a short delay
     */
    private scheduleNextAutoPilotTarget(delay: number = this.autoPilotInterSampleDelay) {
        if (!this.isAutoPilotActive) return;

        if (this.autoPilotNextTargetTimeout !== null) {
            window.clearTimeout(this.autoPilotNextTargetTimeout);
        }

        this.autoPilotNextTargetTimeout = window.setTimeout(() => {
            this.autoPilotNextTargetTimeout = null;
            this.moveToNextTarget();
        }, Math.max(0, delay));
    }

    /**
     * Move to the next autopilot target
     */
    private moveToNextTarget() {
        if (!this.isAutoPilotActive) return;

        this.currentTargetIndex++;

        // Check if we've visited all targets
        if (this.currentTargetIndex >= this.autoPilotTargets.length) {
            this.stopAutoPilot();
            return;
        }

        this.startCurrentTargetPlayback();
    }

    /**
     * Update auto-pilot animation in the render loop
     */
    private updateAutoPilot() {
        if (!this.isAutoPilotActive || !this.camera || !this.controls) return;

        const now = performance.now();
        const deltaTime = this.lastAutoPilotUpdateTime ? now - this.lastAutoPilotUpdateTime : 0;
        this.lastAutoPilotUpdateTime = now;
        const deltaSeconds = deltaTime / 1000;

        if (deltaSeconds > 0) {
            const twoPi = Math.PI * 2;
            this.autoPilotOrbitAngle = (this.autoPilotOrbitAngle + deltaSeconds * this.autoPilotOrbitSpeed) % twoPi;
        }

        const baseOrbitDirection = this.getFocusDirectionFromCenter();
        const tangent = new THREE.Vector3().crossVectors(this.autoPilotOrbitUpAxis, baseOrbitDirection);
        let driftSign = 1;
        if (tangent.lengthSq() > 0 && this.autoPilotDriftDirection.lengthSq() > 0) {
            tangent.normalize();
            const alignment = tangent.dot(this.autoPilotDriftDirection);
            if (alignment < 0) {
                driftSign = -1;
            }
        }
        const wobbleAngle = (this.autoPilotOrbitAngle * this.autoPilotMinorRotationFactor) * driftSign;
        const desiredOrbitDirection = baseOrbitDirection.clone()
            .applyAxisAngle(this.autoPilotOrbitUpAxis, wobbleAngle)
            .normalize();
        this.currentCameraOrbitDirection.lerp(desiredOrbitDirection, 0.08);
        this.autoPilotCameraDirection.copy(this.currentCameraOrbitDirection);

        const target = this.autoPilotTargets[this.currentTargetIndex];
        if (!target) return;

        this.currentAutoPilotFocus.lerp(this.desiredAutoPilotFocus, this.autoPilotFocusLerp);

        const desiredPosition = this.getCameraPositionForTarget(this.autoPilotSceneCenter);
        const blendedFocusTarget = this.autoPilotSceneCenter.clone().lerp(
            this.currentAutoPilotFocus,
            this.autoPilotFocusWeight
        );

        this.camera.position.lerp(desiredPosition, 0.035);
        this.controls.target.lerp(blendedFocusTarget, 0.05);
        this.controls.update();

        if (this.highlightSphere) {
            this.highlightSphere.position.copy(this.currentAutoPilotFocus);
            const pulseScale = 1 + Math.sin(performance.now() * 0.0016) * 0.18;
            this.highlightSphere.scale.set(pulseScale, pulseScale, pulseScale);
        }

        if (this.tooltip && this.renderer && this.camera) {
            const vector = this.currentAutoPilotFocus.clone();
            vector.project(this.camera);

            const rect = this.renderer.domElement.getBoundingClientRect();
            const widthHalf = rect.width / 2;
            const heightHalf = rect.height / 2;

            const screenX = (vector.x * widthHalf) + widthHalf + rect.left;
            const screenY = -(vector.y * heightHalf) + heightHalf + rect.top;

            this.showTooltip(screenX, screenY, target.species);
        }
    }

    private animate = () => {
        if (!this.renderer || !this.scene || !this.camera || !this.controls) return;
        this.animationFrameId = requestAnimationFrame(this.animate);

        // Update auto-pilot if active
        this.updateAutoPilot();

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    public show() {
        this.container.style.display = 'block';
        this.init();
    }

    public hide() {
        this.container.style.display = 'none';
        this.dispose();
    }

    private dispose() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        if (this.scene) {
            this.scene.traverse(object => {
                if (object instanceof THREE.Mesh) {
                    if (object.geometry) object.geometry.dispose();
                    if (object.material) {
                         if (Array.isArray(object.material)) {
                            object.material.forEach(material => material.dispose());
                        } else {
                            object.material.dispose();
                        }
                    }
                }
            });
        }
        if (this.renderer) {
            this.renderer.dispose();
        }
        if (this.controls) {
            this.controls.dispose();
        }
        if (this.tooltip) {
            document.body.removeChild(this.tooltip);
            this.tooltip = null;
        }
        // Remove resize listener
        window.removeEventListener('resize', this.handleResize.bind(this));
        
        this.container.innerHTML = '';
        this.scene = null;
        this.renderer = null;
        this.camera = null;
        this.controls = null;
        this.instancedMesh = null;
    }
}

class MarineMap {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private dataGrid: (GridData | null)[][] = [];
    private dominantStrategyData: any[] = [];
    private tooltip: HTMLElement;
    private currentStrategy: number = 0;
    private isDominantStrategyMode: boolean = false;
    private speciesGridData: Map<string, string[]> = new Map();
    private speciesPanelUpdater: ((gridId: string | null, species: string[]) => void) | null = null;
    private lastSelectedGridId: string | null = null;

    private offscreenCanvas: HTMLCanvasElement;
    private offscreenCtx: CanvasRenderingContext2D;
    private readonly offscreenResolution = 4;

    private zoom = 1;
    private offsetX = 0;
    private offsetY = 0;
    private isDragging = false;
    private lastMouseX = 0;
    private lastMouseY = 0;

    private mapX = 0;
    private mapY = 0;
    private mapWidth = 0;
    private mapHeight = 0;

    constructor(canvasId: string, tooltip: HTMLElement) {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;
        this.tooltip = tooltip;
        
        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenCanvas.width = 360 * this.offscreenResolution;
        this.offscreenCanvas.height = 180 * this.offscreenResolution;
        this.offscreenCtx = this.offscreenCanvas.getContext('2d')!;

        this.initializeGrid();
        this.setupEventListeners();
    }

    public async loadData(data: GridData[], dominantStrategyData?: any[], speciesGridData?: Map<string, string[]>) {
        this.preprocessData(data);
        if (dominantStrategyData) {
            this.dominantStrategyData = dominantStrategyData;
        }
        if (speciesGridData) {
            this.speciesGridData = speciesGridData;
        }
        this.renderOffscreenCanvas();
        this.renderMap();
    }

    public setSpeciesPanelUpdater(callback: (gridId: string | null, species: string[]) => void) {
        this.speciesPanelUpdater = callback;
    }

    public clearHoverInfo() {
        this.hideTooltip();
    }
    
    private initializeGrid() {
        this.dataGrid = new Array(360).fill(null).map(() => new Array(180).fill(null));
    }

    private preprocessData(gridData: GridData[]) {
        gridData.forEach(d => {
            const coords = this.parseGridId(d.grid_id);
            if (coords) {
                const lonIndex = Math.floor(coords.lon + 180);
                const latIndex = Math.floor(90 - coords.lat);
                if (lonIndex >= 0 && lonIndex < 360 && latIndex >= 0 && latIndex < 180) {
                    this.dataGrid[lonIndex][latIndex] = d;
                }
            }
        });
    }

    public renderOffscreenCanvas() {
        this.offscreenCtx.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
        
        if (this.isDominantStrategyMode) {
            // Render dominant strategy data
            for (const d of this.dominantStrategyData) {
                const coords = this.parseGridId(d.grid_id);
                if (coords && d.status === 'success') {
                    const lonIndex = Math.floor(coords.lon + 180);
                    const latIndex = Math.floor(90 - coords.lat);
                    if (lonIndex >= 0 && lonIndex < 360 && latIndex >= 0 && latIndex < 180) {
                        const strategyIndex = parseInt(d.dominant_strategy_pct);
                        const strategyName = this.getStrategyName(strategyIndex);
                        this.offscreenCtx.fillStyle = this.getStrategyColor(strategyName);
                        this.offscreenCtx.fillRect(
                            lonIndex * this.offscreenResolution, 
                            latIndex * this.offscreenResolution, 
                            this.offscreenResolution, 
                            this.offscreenResolution
                        );
                    }
                }
            }
        } else {
            // Render regular strategy data
            const strategyKey = `ses_mean_prob_${this.currentStrategy}` as keyof GridData;
            for (let i = 0; i < 360; i++) {
                for (let j = 0; j < 180; j++) {
                    const dataPoint = this.dataGrid[i][j];
                    if (dataPoint) {
                        const value = parseFloat((dataPoint as any)[strategyKey]) || 0;
                        this.offscreenCtx.fillStyle = this.getSeismicColor(value);
                        this.offscreenCtx.fillRect(
                            i * this.offscreenResolution, 
                            j * this.offscreenResolution, 
                            this.offscreenResolution, 
                            this.offscreenResolution
                        );
                    }
                }
            }
        }
    }

    public renderMap = () => {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        this.ctx.imageSmoothingEnabled = false;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();

        const mapAspectRatio = 2;
        const screenAspectRatio = this.canvas.width / this.canvas.height;

        if (screenAspectRatio > mapAspectRatio) {
            this.mapHeight = this.canvas.height;
            this.mapWidth = this.mapHeight * mapAspectRatio;
        } else {
            this.mapWidth = this.canvas.width;
            this.mapHeight = this.mapWidth / mapAspectRatio;
        }

        this.mapX = (this.canvas.width - this.mapWidth) / 2;
        this.mapY = (this.canvas.height - this.mapHeight) / 2 + this.canvas.height * 0.1;

        const destWidth = this.mapWidth * this.zoom;
        const destHeight = this.mapHeight * this.zoom;
        const destX = this.mapX + this.offsetX;
        const destY = this.mapY + this.offsetY;

        this.ctx.drawImage(this.offscreenCanvas, destX, destY, destWidth, destHeight);

        this.ctx.restore();
    }

    private parseGridId(gridId: string): { lat: number; lon: number } | null {
        if (!gridId) return null;
        const match = gridId.match(/lon(n?)(\d+)p(\d+)_lat(n?)(\d+)p(\d+)/);
        if (!match) return null;
        const [, lonSign, lonWhole, lonDec, latSign, latWhole, latDec] = match;
        let lon = parseFloat(`${lonWhole}.${lonDec}`);
        let lat = parseFloat(`${latWhole}.${latDec}`);
        if (lonSign === 'n') lon = -lon;
        if (latSign === 'n') lat = -lat;
        if (lon > 180) lon = lon - 360;
        return { lat, lon };
    }

    private getSeismicColor(value: number): string {
        const normalizedValue = Math.max(-1, Math.min(1, value / 3));
        let r, g, b;
        if (normalizedValue <= 0) {
            const t = Math.abs(normalizedValue);
            r = Math.round(255 * (1 - t * 0.8)); g = Math.round(255 * (1 - t * 0.6)); b = 255;
        } else {
            const t = normalizedValue;
            r = 255; g = Math.round(255 * (1 - t * 0.6)); b = Math.round(255 * (1 - t * 0.8));
        }
        return `rgb(${r}, ${g}, ${b})`;
    }

    private getStrategyName(strategyIndex: number): string {
        const strategyNames = [
            'Flat Whistles', 'Slow Trills', 'Fast Trills', 'Chaotic Notes',
            'Ultrafast Trills', 'Slow Mod. Whistles', 'Fast Mod. Whistles', 'Harmonic Stacks'
        ];
        return strategyNames[strategyIndex] || 'Unknown';
    }

    private getStrategyColor(strategyName: string): string {
        return strategyColors[strategyName] || '#808080';
    }
    
    public setupEventListeners() {
        window.addEventListener('resize', () => {
            this.zoom = 1;
            this.offsetX = 0;
            this.offsetY = 0;
            this.renderMap();
        });

        // Hide tooltip when page scrolls
        window.addEventListener('scroll', () => {
            this.hideTooltip();
        }, { passive: true });

        this.canvas.addEventListener('mousedown', this.handleMouseDown);
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('mouseup', this.handleMouseUp);
        this.canvas.addEventListener('mouseleave', this.handleMouseUp);
        this.canvas.addEventListener('click', this.handleMapClick);
        this.canvas.addEventListener('wheel', this.handleWheel);
    }

    private handleMouseDown = (e: MouseEvent) => {
        if (this.zoom <= 1) return;
        this.isDragging = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.hideTooltip();
    }

    private handleMouseUp = () => {
        this.isDragging = false;
    }

    private clampOffsets() {
        const minOffsetX = this.mapWidth - this.mapWidth * this.zoom;
        const minOffsetY = this.mapHeight - this.mapHeight * this.zoom;
        this.offsetX = Math.max(minOffsetX, Math.min(0, this.offsetX));
        this.offsetY = Math.max(minOffsetY, Math.min(0, this.offsetY));
    }

    private handleMouseMove = (e: MouseEvent) => {
        if (this.isDragging) {
            const dx = e.clientX - this.lastMouseX;
            const dy = e.clientY - this.lastMouseY;
            this.offsetX += dx;
            this.offsetY += dy;

            this.clampOffsets();

            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            this.renderMap();
        } else {
            // Convert viewport coordinates to canvas coordinates
            const rect = this.canvas.getBoundingClientRect();
            const canvasX = e.clientX - rect.left;
            const canvasY = e.clientY - rect.top;

            const destWidth = this.mapWidth * this.zoom;
            const destHeight = this.mapHeight * this.zoom;
            const destX = this.mapX + this.offsetX;
            const destY = this.mapY + this.offsetY;

            if (canvasX >= destX && canvasX <= destX + destWidth &&
                canvasY >= destY && canvasY <= destY + destHeight) {

                const mapMouseX = canvasX - destX;
                const mapMouseY = canvasY - destY;

                const lon = Math.floor((mapMouseX / destWidth) * 360);
                const lat = Math.floor((mapMouseY / destHeight) * 180);

                if (lon >= 0 && lon < 360 && lat >= 0 && lat < 180) {
                    if (this.isDominantStrategyMode) {
                        // Find dominant strategy data for this position
                        const realLon = lon - 180;
                        const realLat = 90 - lat;
                        const dominantData = this.dominantStrategyData.find(d => {
                            const coords = this.parseGridId(d.grid_id);
                            return coords && Math.abs(coords.lon - realLon) < 0.5 && Math.abs(coords.lat - realLat) < 0.5;
                        });
                        if (dominantData) {
                            this.showTooltip(e.clientX, e.clientY, dominantData);
                        } else {
                            this.hideTooltip();
                        }
                    } else {
                        const dataPoint = this.dataGrid[lon][lat];
                        if (dataPoint) {
                            this.showTooltip(e.clientX, e.clientY, dataPoint);
                        } else {
                            this.hideTooltip();
                        }
                    }
                } else {
                    this.hideTooltip();
                }
            } else {
                this.hideTooltip();
            }
        }
    }

    private handleMapClick = (e: MouseEvent) => {
        if (this.isDragging) return;

        const rect = this.canvas.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;

        const destWidth = this.mapWidth * this.zoom;
        const destHeight = this.mapHeight * this.zoom;
        const destX = this.mapX + this.offsetX;
        const destY = this.mapY + this.offsetY;

        if (!(canvasX >= destX && canvasX <= destX + destWidth &&
            canvasY >= destY && canvasY <= destY + destHeight)) {
            this.notifySpeciesPanel(null);
            return;
        }

        const mapMouseX = canvasX - destX;
        const mapMouseY = canvasY - destY;

        const lon = Math.floor((mapMouseX / destWidth) * 360);
        const lat = Math.floor((mapMouseY / destHeight) * 180);

        if (lon < 0 || lon >= 360 || lat < 0 || lat >= 180) {
            this.notifySpeciesPanel(null);
            return;
        }

        if (this.isDominantStrategyMode) {
            const realLon = lon - 180;
            const realLat = 90 - lat;
            const dominantData = this.dominantStrategyData.find(d => {
                const coords = this.parseGridId(d.grid_id);
                return coords && Math.abs(coords.lon - realLon) < 0.5 && Math.abs(coords.lat - realLat) < 0.5;
            });
            this.notifySpeciesPanel(dominantData ? dominantData.grid_id || null : null);
        } else {
            const dataPoint = this.dataGrid[lon][lat];
            this.notifySpeciesPanel(dataPoint ? dataPoint.grid_id || null : null);
        }
    }

    private handleWheel = (e: WheelEvent) => {
        // Only zoom when Ctrl (or Cmd on Mac) is pressed, otherwise allow normal scrolling
        if (!e.ctrlKey && !e.metaKey) {
            return;
        }

        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const zoomFactor = 1.05; // Reduced from 1.1 to make zoom less sensitive
        const oldZoom = this.zoom;

        const newZoom = e.deltaY < 0 ? oldZoom * zoomFactor : oldZoom / zoomFactor;
        this.zoom = Math.max(1, Math.min(newZoom, 50));

        if (this.zoom === 1) {
            this.offsetX = 0;
            this.offsetY = 0;
        } else {
            const mouseRatioX = (mouseX - this.mapX - this.offsetX) / (this.mapWidth * oldZoom);
            const mouseRatioY = (mouseY - this.mapY - this.offsetY) / (this.mapHeight * oldZoom);

            const newDestWidth = this.mapWidth * this.zoom;
            const newDestHeight = this.mapHeight * this.zoom;

            this.offsetX = (mouseX - this.mapX) - (mouseRatioX * newDestWidth);
            this.offsetY = (mouseY - this.mapY) - (mouseRatioY * newDestHeight);
        }

        this.clampOffsets();
        this.renderMap();
        this.hideTooltip();
    }

    private showTooltip(x: number, y: number, data: GridData | any) {
        this.tooltip.style.display = 'block';

        // Use ECO_NAME if available, otherwise show "Unknown region"
        const ecoregion = data.ECO_NAME || 'Unknown region';

        if (this.isDominantStrategyMode) {
            // Show tooltip for dominant strategy (no SES)
            const strategyIndex = parseInt(data.dominant_strategy_pct);
            const strategyName = this.getStrategyName(strategyIndex);
            this.tooltip.innerHTML = `
                <div><strong>Ecoregion:</strong> ${ecoregion}</div>
                <div style="margin-top: 4px;"><strong>Dominant Motif:</strong> ${strategyName}</div>
                <div style="margin-top: 4px;"><strong>Species Count:</strong> ${data.num_species}</div>
            `;
        } else {
            // Show tooltip for regular strategy (with SES)
            const strategyKey = `ses_mean_prob_${this.currentStrategy}` as keyof GridData;
            const sesValue = parseFloat((data as any)[strategyKey]) || 0;
            const strategyName = (document.querySelector(`#strategy-select option[value="${this.currentStrategy}"]`) as HTMLElement)?.innerText || 'N/A';
            this.tooltip.innerHTML = `
                <div><strong>Ecoregion:</strong> ${ecoregion}</div>
                <div style="margin-top: 4px;"><strong>Motif:</strong> ${strategyName}</div>
                <div style="margin-top: 4px;"><strong>Motif prevalence (SES):</strong> <span style="color: ${this.getSeismicColor(sesValue)}; font-weight: 500;">${sesValue.toFixed(2)}</span></div>
            `;
        }

        // Position tooltip to left if cursor is in right half of screen
        const isRightHalf = x > window.innerWidth / 2;
        if (isRightHalf) {
            // Position to the left of cursor
            this.tooltip.style.left = `${x - this.tooltip.offsetWidth - 15}px`;
        } else {
            // Position to the right of cursor
            this.tooltip.style.left = `${x + 15}px`;
        }
        this.tooltip.style.top = `${y + 15}px`;

        this.tooltip.style.opacity = '1';
    }

    private hideTooltip() {
        this.tooltip.style.opacity = '0';
        setTimeout(() => {
            if (this.tooltip.style.opacity === '0') {
                this.tooltip.style.display = 'none';
            }
        }, 200);
    }

    private notifySpeciesPanel(gridId: string | null) {
        if (!this.speciesPanelUpdater) return;
        if (this.lastSelectedGridId === gridId) return;
        this.lastSelectedGridId = gridId;
        const species = gridId ? (this.speciesGridData.get(gridId) || []) : [];
        this.speciesPanelUpdater(gridId, species);
    }

    public show() {
        this.canvas.style.display = 'block';
    }

    public hide() {
        this.canvas.style.display = 'none';
    }

    public setStrategy(strategy: number | string) {
        if (strategy === 'dominant') {
            this.isDominantStrategyMode = true;
        } else {
            this.isDominantStrategyMode = false;
            this.currentStrategy = Number(strategy);
        }
        this.renderOffscreenCanvas();
        this.renderMap();
    }
}

type SpeciesEntry = {
    id: string;
    label: string;
    family: string;
};

class App {
    private dataLoader = new OptimizedDataLoader();
    private marineMap: MarineMap;
    private acousticSpace: AcousticSpace;
    private mapViewBtn: HTMLButtonElement;
    private spaceViewBtn: HTMLButtonElement;
    private strategySelect: HTMLSelectElement;
    private mapSidePanel: HTMLElement;
    private spaceSidePanel: HTMLElement;
    private mapPanelDragHandle: HTMLElement | null = null;
    private spacePanelDragHandle: HTMLElement | null = null;
    private spaceActionControl: HTMLElement;
    private currentView: 'map' | 'space' = 'map';
    private isMapPanelOpen = true;
    private isSpacePanelOpen = false;
    private mapPanelDragOffset = 0;
    private spacePanelDragOffset = 0;

    private colorModeSelect: HTMLSelectElement;
    private dimensionFilterControl: HTMLElement;
    private dimensionFilterLabel: HTMLLabelElement;
    private dimensionFilterSelect: HTMLSelectElement;
    private dimensionFilterHint: HTMLElement;
    private speciesFilterWrapper: HTMLElement;
    private speciesFilterInput: HTMLInputElement;
    private speciesFilterOptions: HTMLDataListElement;
    private spectrogramImg: HTMLImageElement;
    private autoPilotBtn: HTMLButtonElement;
    private resetFiltersBtn: HTMLButtonElement;
    private gridSpeciesPanel: HTMLElement;
    private gridSpeciesList: HTMLElement;
    private gridUmapCanvas: HTMLCanvasElement | null = null;
    private gridUmapCtx: CanvasRenderingContext2D | null = null;
    private gridUmapOverlay: HTMLElement | null = null;
    private currentGridSpecies: string[] = [];
    private currentGridId: string | null = null;
    private speciesUmapLookup: Map<string, Array<[number, number]>> = new Map();
    private globalUmapBounds: { minX: number; maxX: number; minY: number; maxY: number } | null = null;
    private allSpeciesEntries: SpeciesEntry[] = [];
    private speciesLabelToId: Map<string, string> = new Map();
    private speciesIdToLabel: Map<string, string> = new Map();
    private allSpeciesOptionsHTML: string = '';
    private speciesSelectOptionsHTML: string = '';
    private families: string[] = [];

    private strategySpectrograms: { [key: number]: string } = {
        0: '/images/strategies/flat_whistle.png',
        1: '/images/strategies/slow_trill.png',
        2: '/images/strategies/fast_trill.png',
        3: '/images/strategies/chaotic_note.png',
        4: '/images/strategies/ultra_fast_trill.png',
        5: '/images/strategies/slow_whistle.png',
        6: '/images/strategies/fast_mod_whistle.png',
        7: '/images/strategies/harmonic_stacks.png'
    };

    constructor() {
        const tooltip = this.createTooltip();
        this.marineMap = new MarineMap('map-canvas', tooltip);
        this.acousticSpace = new AcousticSpace('acoustic-space-container');

        this.mapViewBtn = document.getElementById('map-view-btn') as HTMLButtonElement;
        this.spaceViewBtn = document.getElementById('space-view-btn') as HTMLButtonElement;
        this.strategySelect = document.getElementById('strategy-select') as HTMLSelectElement;
        this.mapSidePanel = document.getElementById('map-side-panel') as HTMLElement;
        this.spaceSidePanel = document.getElementById('space-side-panel') as HTMLElement;
        this.mapPanelDragHandle = document.getElementById('map-panel-drag-handle');
        this.spacePanelDragHandle = document.getElementById('space-panel-drag-handle');
        this.colorModeSelect = document.getElementById('color-mode-select') as HTMLSelectElement;
        this.dimensionFilterControl = document.getElementById('dimension-filter-control') as HTMLElement;
        this.dimensionFilterLabel = document.getElementById('dimension-filter-label') as HTMLLabelElement;
        this.dimensionFilterSelect = document.getElementById('dimension-filter-select') as HTMLSelectElement;
        this.dimensionFilterHint = document.getElementById('dimension-filter-hint') as HTMLElement;
        this.speciesFilterWrapper = document.getElementById('dimension-species-wrapper') as HTMLElement;
        this.speciesFilterInput = document.getElementById('dimension-species-input') as HTMLInputElement;
        this.speciesFilterOptions = document.getElementById('dimension-species-options') as HTMLDataListElement;
        this.spectrogramImg = document.getElementById('strategy-spectrogram') as HTMLImageElement;
        this.autoPilotBtn = document.getElementById('autopilot-btn') as HTMLButtonElement;
        this.resetFiltersBtn = document.getElementById('reset-filters-btn') as HTMLButtonElement;
        this.spaceActionControl = document.getElementById('autopilot-control') as HTMLElement;
        this.gridSpeciesPanel = document.getElementById('grid-species-panel') as HTMLElement;
        this.gridSpeciesList = document.getElementById('grid-species-list') as HTMLElement;
        this.gridUmapCanvas = document.getElementById('grid-umap-canvas') as HTMLCanvasElement;
        this.gridUmapOverlay = document.getElementById('grid-umap-empty') as HTMLElement;
        if (this.gridUmapCanvas) {
            this.gridUmapCtx = this.gridUmapCanvas.getContext('2d');
        }
        this.applyPanelOffset(this.mapSidePanel, this.mapPanelDragOffset);
        this.applyPanelOffset(this.spaceSidePanel, this.spacePanelDragOffset);
        this.setSpacePanelState(false);
        this.setMapPanelState(true);
        this.setButtonState(this.autoPilotBtn, true);
        this.setButtonState(this.resetFiltersBtn, false);
        this.initPanelDragging(this.mapSidePanel, this.mapPanelDragHandle, 'map');
        this.initPanelDragging(this.spaceSidePanel, this.spacePanelDragHandle, 'space');

        this.acousticSpace.setAutoPilotStateListener((active) => {
            this.updateAutoPilotButtonState(active);
        });
        this.updateAutoPilotButtonState(false);

        this.marineMap.setSpeciesPanelUpdater((gridId, species) => {
            this.updateGridSpeciesPanel(gridId, species);
        });
        const hideHoverInfo = () => this.marineMap.clearHoverInfo();
        this.mapSidePanel?.addEventListener('pointerenter', hideHoverInfo);
        this.spaceSidePanel?.addEventListener('pointerenter', hideHoverInfo);

        window.addEventListener('resize', () => {
            if (this.currentGridSpecies.length > 0) {
                this.renderGridUmapScatter(this.currentGridSpecies);
            }
            this.clampPanelOffsetsToBounds();
        });

        this.renderGridUmapScatter([]);

        this.setupEventListeners();
        this.loadData();
    }

    private createTooltip(): HTMLElement {
        const tooltip = document.createElement('div');
        tooltip.id = 'map-tooltip';
        tooltip.style.cssText = `
            position: fixed;
            display: none;
            background: rgba(0, 0, 0, 0.85);
            color: white;
            padding: 10px 15px;
            border-radius: 8px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            pointer-events: none;
            z-index: 2000;
            backdrop-filter: blur(10px);
            transition: opacity 0.2s ease;
            white-space: nowrap;
        `;
        document.body.appendChild(tooltip);
        return tooltip;
    }

    private async loadData() {
        try {
            console.log("Loading data for marine visualization...");

            // Load all data including dominant strategy data
            const allData = await this.dataLoader.loadAllBiogeographyData();

            // Load grid data for the map with dominant strategy data
            this.marineMap.loadData(allData.gridData, allData.dominantStrategyData, allData.speciesGridData);
            this.cacheSpeciesUmap(allData.speciesUmapData);

            // Load traits data for acoustic space
            if (allData.traitsData && allData.traitsData.length > 0) {
                console.log(`Successfully loaded ${allData.traitsData.length} records for acoustic space.`);
                this.acousticSpace.loadData(allData.traitsData);
                this.cacheFamilyList();
                this.initializeSpeciesSearch();
                this.updateDimensionFilterUI();
            } else {
                console.warn("Traits data is not available or empty, acoustic space view will be empty.");
            }

            // Initialize legend and controls
            this.updateControlsVisibility();
            this.updateLegend();
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    private cacheFamilyList() {
        this.families = this.acousticSpace.getAllFamilies();
    }

    private cacheSpeciesUmap(data?: Record<string, number[][]>) {
        if (!data) return;
        this.speciesUmapLookup.clear();
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const [species, coords] of Object.entries(data)) {
            if (!Array.isArray(coords)) continue;
            const filtered: Array<[number, number]> = [];
            for (const pair of coords) {
                if (!Array.isArray(pair) || pair.length < 2) continue;
                const x = Number(pair[0]);
                const y = Number(pair[1]);
                if (Number.isFinite(x) && Number.isFinite(y)) {
                    filtered.push([x, y]);
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
            if (filtered.length) {
                this.speciesUmapLookup.set(species, filtered);
            }
        }
        if (minX !== Infinity && maxX !== -Infinity && minY !== Infinity && maxY !== -Infinity) {
            this.globalUmapBounds = { minX, maxX, minY, maxY };
        }
    }

    private initializeSpeciesSearch() {
        const speciesEntriesRaw = this.acousticSpace.getAllSpeciesEntries();
        if (!speciesEntriesRaw || speciesEntriesRaw.length === 0) {
            this.speciesFilterInput.disabled = true;
            this.speciesFilterInput.placeholder = 'Species data unavailable';
            return;
        }

        this.allSpeciesEntries = speciesEntriesRaw.map(entry => ({
            id: entry.species,
            family: entry.family,
            label: this.formatSpeciesLabel(entry.species)
        })).sort((a, b) => a.label.localeCompare(b.label));

        this.speciesLabelToId.clear();
        this.speciesIdToLabel.clear();
        this.allSpeciesEntries.forEach(entry => {
            this.speciesLabelToId.set(entry.label.toLowerCase(), entry.id);
            this.speciesIdToLabel.set(entry.id, entry.label);
        });

        this.allSpeciesOptionsHTML = this.buildSpeciesOptionsHTML(this.allSpeciesEntries);
        this.speciesSelectOptionsHTML = this.buildSpeciesSelectOptionsHTML(this.allSpeciesEntries);
        this.speciesFilterOptions.innerHTML = this.allSpeciesOptionsHTML;
        this.speciesFilterInput.disabled = false;
        this.speciesFilterInput.placeholder = 'Start typing any species name';
    }

    private buildSpeciesOptionsHTML(entries: SpeciesEntry[]): string {
        return entries.map(entry => {
            const displayLabel = `${entry.label} · ${entry.family}`;
            return `<option value="${entry.label}" label="${displayLabel}"></option>`;
        }).join('');
    }

    private buildSpeciesSelectOptionsHTML(entries: SpeciesEntry[]): string {
        const options = ['<option value="">All Species</option>'];
        for (const entry of entries) {
            const displayLabel = `${entry.label} · ${entry.family}`;
            options.push(`<option value="${entry.id}">${displayLabel}</option>`);
        }
        return options.join('');
    }

    private resetDimensionFilterInputs() {
        if (this.dimensionFilterSelect) {
            this.dimensionFilterSelect.value = '';
        }
        if (this.speciesFilterInput) {
            this.speciesFilterInput.value = '';
            this.speciesFilterInput.setCustomValidity('');
        }
    }

    private isSpeciesSearchActive(): boolean {
        return !!this.speciesFilterWrapper && this.speciesFilterWrapper.style.display !== 'none';
    }

    private handleSpeciesSelectionFromInput() {
        if (!this.isSpeciesSearchActive()) {
            return;
        }
        const rawValue = this.speciesFilterInput.value.trim();
        if (!rawValue) {
            this.clearSpeciesSelection();
            return;
        }

        const speciesId = this.resolveSpeciesValue(rawValue);
        if (!speciesId) {
            this.speciesFilterInput.setCustomValidity('Please choose a species from the list');
            this.speciesFilterInput.reportValidity();
            return;
        }

        this.speciesFilterInput.setCustomValidity('');
        this.applyDimensionFilter(speciesId);
    }

    private clearSpeciesSelection() {
        if (this.isSpeciesSearchActive()) {
            this.speciesFilterInput.setCustomValidity('');
            this.speciesFilterInput.value = '';
        }
        this.applyDimensionFilter('');
        this.dimensionFilterSelect.value = '';
    }

    private normalizeSpeciesValue(value: string | null | undefined): string | null {
        if (!value) return null;
        if (this.speciesIdToLabel.has(value)) {
            return value;
        }
        const normalized = value.trim().toLowerCase();
        if (this.speciesLabelToId.has(normalized)) {
            return this.speciesLabelToId.get(normalized)!;
        }
        return null;
    }

    private resolveSpeciesValue(rawValue: string): string | null {
        if (!rawValue) return null;
        const trimmed = rawValue.trim();
        if (!trimmed) return null;

        const normalized = trimmed.toLowerCase();
        if (this.speciesLabelToId.has(normalized)) {
            return this.speciesLabelToId.get(normalized)!;
        }

        const canonical = trimmed.replace(/\s+/g, '_');
        if (this.speciesIdToLabel.has(canonical)) {
            return canonical;
        }

        const canonicalLower = canonical.toLowerCase();
        if (this.speciesLabelToId.has(canonicalLower)) {
            return this.speciesLabelToId.get(canonicalLower)!;
        }

        return null;
    }

    private formatSpeciesLabel(species: string): string {
        return species.replace(/_/g, ' ');
    }

    private resetViewToDefault() {
        this.colorModeSelect.value = 'family';
        this.handleColorModeChange();
    }

    private handleColorModeChange() {
        const mode = this.colorModeSelect.value as 'family' | 'syndrome' | 'species';
        this.acousticSpace.setColorMode(mode);
        this.resetDimensionFilterInputs();
        this.applyDimensionFilter('');
        this.updateDimensionFilterUI();
        this.updateControlsVisibility();
        this.updateAcousticSpaceLegend();
    }

    private applyDimensionFilter(value: string) {
        const mode = this.colorModeSelect.value as 'family' | 'syndrome' | 'species';

        if (mode === 'syndrome') {
            const parsed = value ? parseInt(value, 10) : null;
            this.acousticSpace.setSyndromeFilter(Number.isNaN(parsed as number) ? null : parsed);
            this.acousticSpace.setSelectedFamily(null);
            this.acousticSpace.setSelectedSpecies(null);
            this.dimensionFilterSelect.value = value || '';
            if (value && !Number.isNaN(parsed as number)) {
                this.dimensionFilterHint.textContent = `Selected: ${strategyNames[parsed!]}`;
            } else {
                this.dimensionFilterHint.textContent = 'Choose a motif to emphasize.';
            }
        } else if (mode === 'family') {
            this.acousticSpace.setSyndromeFilter(null);
            this.acousticSpace.setSelectedFamily(value || null);
            this.acousticSpace.setSelectedSpecies(null);
            this.dimensionFilterSelect.value = value || '';
            this.dimensionFilterHint.textContent = value ? `Selected: ${value}` : 'Select a family to highlight.';
        } else {
            this.acousticSpace.setSyndromeFilter(null);
            const speciesId = this.normalizeSpeciesValue(value);
            this.dimensionFilterSelect.value = speciesId || '';
            if (speciesId) {
                this.acousticSpace.setSelectedSpecies(speciesId);
                const label = this.speciesIdToLabel.get(speciesId) || this.formatSpeciesLabel(speciesId);
                this.dimensionFilterHint.textContent = `Selected: ${label}`;
            } else {
                this.acousticSpace.setSelectedSpecies(null);
                this.dimensionFilterHint.textContent = 'Choose a species to highlight.';
            }
        }

        this.updateSpeciesLegend();
        this.updateAcousticSpaceLegend();
        this.updateAutoPilotAvailability();
    }

    private updateDimensionFilterUI() {
        if (!this.dimensionFilterControl) return;
        const isSpaceView = this.currentView === 'space';
        this.setPanelGroupVisibility(this.dimensionFilterControl, isSpaceView);
        if (!isSpaceView) return;

        const mode = this.colorModeSelect.value as 'family' | 'syndrome' | 'species';
        if (mode === 'species') {
            this.dimensionFilterLabel.textContent = 'Highlight Species';
            this.dimensionFilterLabel.htmlFor = 'dimension-filter-select';
            this.dimensionFilterSelect.style.display = 'block';
            this.speciesFilterWrapper.style.display = 'none';
            if (this.speciesSelectOptionsHTML) {
                this.dimensionFilterSelect.innerHTML = this.speciesSelectOptionsHTML;
            }
            const currentSpecies = this.acousticSpace.getSelectedSpecies();
            this.dimensionFilterSelect.value = currentSpecies || '';
            this.dimensionFilterHint.textContent = currentSpecies
                ? `Selected: ${this.speciesIdToLabel.get(currentSpecies) || this.formatSpeciesLabel(currentSpecies)}`
                : 'Choose a species to highlight.';
            return;
        }

        this.dimensionFilterLabel.textContent = mode === 'syndrome' ? 'Highlight Motif' : 'Highlight Family';
        this.dimensionFilterLabel.htmlFor = 'dimension-filter-select';
        this.dimensionFilterSelect.style.display = 'block';
        this.speciesFilterWrapper.style.display = 'none';
        if (mode === 'syndrome') {
            const options = Object.entries(strategyNames).map(([value, label]) =>
                `<option value="${value}">${label}</option>`
            ).join('');
            this.dimensionFilterSelect.innerHTML = `<option value="">All Motifs</option>${options}`;
            this.dimensionFilterHint.textContent = 'Choose a motif to emphasize.';
            const active = this.acousticSpace.getSyndromeFilter();
            this.dimensionFilterSelect.value = active !== null ? String(active) : '';
        } else {
            const familyOptions = this.families.map(family =>
                `<option value="${family}">${family}</option>`
            ).join('');
            this.dimensionFilterSelect.innerHTML = `<option value="">All Families</option>${familyOptions}`;
            this.dimensionFilterHint.textContent = 'Select a family to highlight.';
            const activeFamily = this.acousticSpace.getSelectedFamily();
            this.dimensionFilterSelect.value = activeFamily || '';
        }
    }

    private setupEventListeners() {
        this.mapViewBtn.addEventListener('click', () => {
            this.switchToMapView();
        });

        this.spaceViewBtn.addEventListener('click', () => {
            this.switchToSpaceView();
        });

        this.strategySelect.addEventListener('change', (e) => {
            const strategy = (e.target as HTMLSelectElement).value;
            this.marineMap.setStrategy(strategy === 'dominant' ? 'dominant' : parseInt(strategy));
            this.updateSpectrogram(strategy);
            this.updateLegend();
        });

        this.colorModeSelect.addEventListener('change', () => {
            this.handleColorModeChange();
        });

        this.dimensionFilterSelect.addEventListener('change', (e) => {
            const value = (e.target as HTMLSelectElement).value || '';
            this.applyDimensionFilter(value);
        });

        this.speciesFilterInput.addEventListener('change', () => {
            this.handleSpeciesSelectionFromInput();
        });

        this.speciesFilterInput.addEventListener('input', (event) => {
            if (!this.isSpeciesSearchActive()) return;
            const value = (event.target as HTMLInputElement).value.trim();
            if (!value) {
                this.clearSpeciesSelection();
            }
        });

        this.autoPilotBtn.addEventListener('click', () => {
            if (this.autoPilotBtn.disabled) return;
            const started = this.acousticSpace.startAutoPilot();
            if (!started) {
                this.updateAutoPilotButtonState(false);
            }
        });

        this.resetFiltersBtn.addEventListener('click', () => {
            this.resetViewToDefault();
        });
    }

    private updateAutoPilotButtonState(active: boolean) {
        if (!this.autoPilotBtn) return;
        this.autoPilotBtn.textContent = active ? 'Stop Auto-Pilot' : 'Auto-Pilot';
        this.autoPilotBtn.classList.toggle('active', active);
        this.autoPilotBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
        if (active) {
            this.autoPilotBtn.disabled = false;
            this.autoPilotBtn.removeAttribute('title');
        } else {
            this.updateAutoPilotAvailability();
        }
    }

    private updateAutoPilotAvailability() {
        if (!this.autoPilotBtn || !this.resetFiltersBtn) return;
        const hasFilters = this.acousticSpace.hasActiveFilters();
        const isSpaceView = this.currentView === 'space';
        const isRunning = this.acousticSpace.isAutoPilotRunning();

        if (!isSpaceView) {
            this.setPanelGroupVisibility(this.spaceActionControl, false);
            return;
        }

        this.setPanelGroupVisibility(this.spaceActionControl, true);

        const autoPilotVisible = !hasFilters || isRunning;
        this.setButtonState(this.autoPilotBtn, autoPilotVisible);
        this.setButtonState(this.resetFiltersBtn, !autoPilotVisible);

        if (autoPilotVisible) {
            this.autoPilotBtn.disabled = false;
            if (!isRunning) {
                this.autoPilotBtn.title = '';
            }
            this.resetFiltersBtn.removeAttribute('title');
        } else {
            this.resetFiltersBtn.disabled = false;
            this.resetFiltersBtn.title = 'Reset view to enable Auto-Pilot.';
        }
    }

    private updateControlsVisibility() {
        const strategyControl = document.getElementById('strategy-control')!;
        const spectrogramControl = document.getElementById('spectrogram-control')!;
        const colorModeControl = document.getElementById('color-mode-control')!;
        const legendPanel = document.getElementById('legend-panel')!;
        const speciesLegendPanel = document.getElementById('species-legend-panel')!;
        const spacePanel = this.spaceSidePanel;

        if (this.currentView === 'space') {
            spacePanel.style.display = 'flex';
            this.mapSidePanel.style.display = 'none';
            this.setSpacePanelState(true);
            this.setMapPanelState(false);
            strategyControl.style.display = 'none';
            spectrogramControl.style.display = 'none';
            legendPanel.style.display = 'none';
            this.setPanelGroupVisibility(colorModeControl, true);
            this.updateDimensionFilterUI();
            this.updateAcousticSpaceLegend();
            this.setPanelGroupVisibility(this.spaceActionControl, true);
            this.updateGridSpeciesPanel(null, []);
        } else {
            spacePanel.style.display = 'none';
            this.mapSidePanel.style.display = 'flex';
            this.setSpacePanelState(false);
            this.setMapPanelState(true);
            strategyControl.style.display = 'block';
            spectrogramControl.style.display = 'block';
            legendPanel.style.display = 'block';
            this.setPanelGroupVisibility(colorModeControl, false);
            speciesLegendPanel.style.display = 'none';
            this.setPanelGroupVisibility(this.dimensionFilterControl, false);
            this.setPanelGroupVisibility(this.spaceActionControl, false);
            this.updateSpectrogram(this.strategySelect.value);
        }

        this.updateAutoPilotAvailability();
    }

    private updateSpectrogram(strategy: string) {
        if (strategy === 'dominant') {
            // Hide spectrogram for dominant strategy mode
            const spectrogramControl = document.getElementById('spectrogram-control')!;
            spectrogramControl.style.display = 'none';
        } else {
            const spectrogramControl = document.getElementById('spectrogram-control')!;
            spectrogramControl.style.display = 'block';
            const strategyNum = parseInt(strategy);
            this.spectrogramImg.src = this.strategySpectrograms[strategyNum];
        }
    }

    private updateSpeciesLegend() {
        const speciesLegendPanel = document.getElementById('species-legend-panel')!;
        const speciesLegend = document.getElementById('species-legend')!;
        speciesLegendPanel.style.display = 'none';
        speciesLegend.innerHTML = '';
    }

    private updateLegend() {
        if (this.currentView !== 'map') return;
        
        const legendContainer = document.getElementById('color-legend')!;
        const strategy = this.strategySelect.value;
        
        if (strategy === 'dominant') {
            // Show motif color legend
            legendContainer.innerHTML = `
                <div style="margin-bottom: 8px; font-weight: 500;">Acoustic Motifs</div>
                ${Object.entries(strategyColors).map(([name, color]) =>
                    `<div style="display: flex; align-items: center; margin-bottom: 4px;">
                        <div style="width: 14px; height: 14px; background: ${color}; margin-right: 8px; border-radius: 2px; border: 1px solid rgba(255,255,255,0.3);"></div>
                        <span>${name}</span>
                    </div>`
                ).join('')}
            `;
        } else {
            // Show motif prevalence color scale
            legendContainer.innerHTML = `
                <div style="margin-bottom: 8px; font-weight: 500;">Motif Prevalence</div>
                <div style="display: flex; align-items: center; margin-bottom: 4px;">
                    <div style="width: 14px; height: 14px; background: rgb(255, 0, 0); margin-right: 8px; border-radius: 2px; border: 1px solid rgba(255,255,255,0.3);"></div>
                    <span>Very High</span>
                </div>
                <div style="display: flex; align-items: center; margin-bottom: 4px;">
                    <div style="width: 14px; height: 14px; background: rgb(255, 160, 160); margin-right: 8px; border-radius: 2px; border: 1px solid rgba(255,255,255,0.3);"></div>
                    <span>High</span>
                </div>
                <div style="display: flex; align-items: center; margin-bottom: 4px;">
                    <div style="width: 14px; height: 14px; background: rgb(255, 255, 255); margin-right: 8px; border-radius: 2px; border: 1px solid rgba(255,255,255,0.5);"></div>
                    <span>Average</span>
                </div>
                <div style="display: flex; align-items: center; margin-bottom: 4px;">
                    <div style="width: 14px; height: 14px; background: rgb(160, 160, 255); margin-right: 8px; border-radius: 2px; border: 1px solid rgba(255,255,255,0.3);"></div>
                    <span>Low</span>
                </div>
                <div style="display: flex; align-items: center;">
                    <div style="width: 14px; height: 14px; background: rgb(0, 0, 255); margin-right: 8px; border-radius: 2px; border: 1px solid rgba(255,255,255,0.3);"></div>
                    <span>Very Low</span>
                </div>
            `;
        }
    }

    private updateAcousticSpaceLegend() {
        const legendPanel = document.getElementById('legend-panel')!;
        const legendContainer = document.getElementById('color-legend')!;
        if (this.currentView !== 'space') {
            legendPanel.style.display = 'block';
            return;
        }

        const mode = this.colorModeSelect.value as 'family' | 'syndrome' | 'species';
        const selectedFamily = this.acousticSpace.getSelectedFamily();
        const selectedSpecies = this.acousticSpace.getSelectedSpecies();
        const selectedSyndrome = this.acousticSpace.getSyndromeFilter();

        if (mode === 'family') {
            legendPanel.style.display = 'block';
            if (!selectedFamily) {
                legendPanel.style.display = 'none';
                legendContainer.innerHTML = '';
                return;
            }

            const familySpecies = this.acousticSpace.getCurrentFamilySpecies();
            if (!familySpecies.length) {
                legendContainer.innerHTML = `
                    <div style="margin-bottom: 8px; font-weight: 500;">${selectedFamily}</div>
                    <div style="line-height: 1.4; opacity: 0.85;">No species data available for this family.</div>
                `;
                return;
            }

            const limit = 12;
            const displayedSpecies = familySpecies.slice(0, limit);
            const remaining = familySpecies.length - displayedSpecies.length;

            legendContainer.innerHTML = `
                <div style="margin-bottom: 8px; font-weight: 500;">Species in ${selectedFamily}</div>
                ${displayedSpecies.map(entry => {
                    const label = this.speciesIdToLabel.get(entry.species) || this.formatSpeciesLabel(entry.species);
                    return `
                        <div style="display: flex; align-items: center; margin-bottom: 4px;">
                            <div style="width: 14px; height: 14px; background: ${entry.color}; margin-right: 8px; border-radius: 2px; border: 1px solid rgba(255,255,255,0.3);"></div>
                            <span>${label}</span>
                        </div>
                    `;
                }).join('')}
                ${remaining > 0 ? `<div style="margin-top: 6px; font-style: italic; opacity: 0.75;">...and ${remaining} more species</div>` : ''}
                <div style="margin-top: 6px; line-height: 1.4; opacity: 0.85;">${selectedFamily} members are colored by species while other families stay muted.</div>
            `;
            return;
        }

        if (mode === 'syndrome') {
            legendPanel.style.display = 'block';
            const activeName = selectedSyndrome !== null ? strategyNames[selectedSyndrome] : null;
            legendContainer.innerHTML = `
                <div style="margin-bottom: 8px; font-weight: 500;">Acoustic Motifs</div>
                ${Object.entries(strategyColors).map(([name, color]) => {
                    const emphasis = name === activeName ? 'font-weight: 600;' : 'opacity: 0.8;';
                    return `
                        <div style="display: flex; align-items: center; margin-bottom: 4px; ${emphasis}">
                            <div style="width: 14px; height: 14px; background: ${color}; margin-right: 8px; border-radius: 2px; border: 1px solid rgba(255,255,255,0.3);"></div>
                            <span>${name}</span>
                        </div>
                    `;
                }).join('')}
                ${activeName ? `<div style="margin-top: 6px; font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase; opacity: 0.7;">Highlighted: ${activeName}</div>` : ''}
            `;
            return;
        }

        // Species color mode
        if (!selectedSpecies) {
            legendPanel.style.display = 'none';
            legendContainer.innerHTML = '';
            return;
        }

        const info = this.acousticSpace.getSpeciesColorInfo(selectedSpecies);
        if (info) {
            legendPanel.style.display = 'block';
            legendContainer.innerHTML = `
                <div style="margin-bottom: 8px; font-weight: 500;">Highlighted Species</div>
                <div style="display: flex; align-items: center; margin-bottom: 6px;">
                    <div style="width: 14px; height: 14px; background: ${info.color}; margin-right: 8px; border-radius: 2px; border: 1px solid rgba(255,255,255,0.3);"></div>
                    <span>${info.label}</span>
                </div>
                <div style="line-height: 1.4; opacity: 0.85;">Only the highlighted species is drawn at full opacity. Clear the highlight to restore all species colors.</div>
            `;
        } else {
            legendPanel.style.display = 'none';
            legendContainer.innerHTML = '';
        }
    }

    private updateGridSpeciesPanel(gridId: string | null, species: string[]) {
        if (!this.gridSpeciesPanel || !this.gridSpeciesList) return;

        if (!gridId || species.length === 0) {
            this.currentGridSpecies = [];
            this.currentGridId = null;
            this.gridSpeciesList.innerHTML = `<div class="species-list-empty">Click a map cell to view the species found there.</div>`;
            this.renderGridUmapScatter([]);
            return;
        }

        this.currentGridId = gridId;
        this.currentGridSpecies = species;
        this.renderGridSpeciesList();
        this.renderGridUmapScatter(species);
    }

    private renderGridSpeciesList() {
        if (!this.gridSpeciesList) return;
        if (this.currentGridSpecies.length === 0) {
            this.gridSpeciesList.innerHTML = `<div class="species-list-empty">Click a map cell to view the species found there.</div>`;
            return;
        }

        const rows = this.currentGridSpecies.map((species, index) => {
            const label = this.speciesIdToLabel.get(species) || this.formatSpeciesLabel(species);
            const order = (index + 1).toString().padStart(2, '0');
            return `<div class="species-list-item"><span>${order}</span>${label}</div>`;
        }).join('');
        this.gridSpeciesList.innerHTML = rows;
    }

    private gatherSpeciesSamplePoints(species: string[]): Array<[number, number]> {
        const samples: Array<[number, number]> = [];
        for (const name of species) {
            const coords = this.speciesUmapLookup.get(name);
            if (!coords) continue;
            samples.push(...coords);
        }
        return samples;
    }

    private renderGridUmapScatter(species: string[]) {
        if (!this.gridUmapCanvas || !this.gridUmapCtx) return;
        const overlay = this.gridUmapOverlay;
        const ctx = this.gridUmapCtx;
        const width = this.gridUmapCanvas.clientWidth || 1;
        const height = this.gridUmapCanvas.clientHeight || 1;
        const dpr = window.devicePixelRatio || 1;
        this.gridUmapCanvas.width = width * dpr;
        this.gridUmapCanvas.height = height * dpr;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.gridUmapCanvas.width, this.gridUmapCanvas.height);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.fillRect(0, 0, width, height);

        const points = this.gatherSpeciesSamplePoints(species);
        if (overlay) {
            overlay.style.display = points.length === 0 ? 'block' : 'none';
        }
        if (points.length === 0) {
            return;
        }

        let bounds = this.globalUmapBounds;
        if (!bounds) {
            const xs = points.map(p => p[0]);
            const ys = points.map(p => p[1]);
            bounds = {
                minX: Math.min(...xs),
                maxX: Math.max(...xs),
                minY: Math.min(...ys),
                maxY: Math.max(...ys)
            };
        }
        const { minX, maxX, minY, maxY } = bounds;
        const padding = 10;
        const spanX = maxX - minX || 1;
        const spanY = maxY - minY || 1;
        const scaleX = (width - padding * 2) / spanX;
        const scaleY = (height - padding * 2) / spanY;

        const densities = new Array(points.length).fill(1);
        const radius = Math.max(spanX, spanY) / 25 || 1;
        const radiusSq = radius * radius;
        for (let i = 0; i < points.length; i++) {
            for (let j = i + 1; j < points.length; j++) {
                const dx = points[i][0] - points[j][0];
                const dy = points[i][1] - points[j][1];
                if (dx * dx + dy * dy <= radiusSq) {
                    densities[i] += 1;
                    densities[j] += 1;
                }
            }
        }
        const minD = Math.min(...densities);
        const maxD = Math.max(...densities);
        const denom = maxD - minD || 1;

        for (let i = 0; i < points.length; i++) {
            const [x, y] = points[i];
            const norm = (densities[i] - minD) / denom;
            const px = padding + (x - minX) * scaleX;
            const py = height - padding - (y - minY) * scaleY;
            ctx.fillStyle = this.magmaColor(norm);
            ctx.beginPath();
            ctx.arc(px, py, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    private magmaColor(t: number): string {
        const palette = ['#000004', '#1B0C41', '#4F0C6B', '#781C6D', '#A52C60', '#C73B50', '#E65C2F', '#F98C0A', '#F9D44A'];
        const clamped = Math.min(1, Math.max(0, t));
        const scaled = clamped * (palette.length - 1);
        const idx = Math.floor(scaled);
        const frac = scaled - idx;
        if (idx >= palette.length - 1) {
            return palette[palette.length - 1];
        }
        return this.interpolateColor(palette[idx], palette[idx + 1], frac);
    }

    private interpolateColor(start: string, end: string, t: number): string {
        const parse = (hex: string) => {
            const n = parseInt(hex.slice(1), 16);
            return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
        };
        const [r1, g1, b1] = parse(start);
        const [r2, g2, b2] = parse(end);
        const r = Math.round(r1 + (r2 - r1) * t);
        const g = Math.round(g1 + (g2 - g1) * t);
        const b = Math.round(b1 + (b2 - b1) * t);
        return `rgb(${r}, ${g}, ${b})`;
    }

    private setSpacePanelState(open: boolean) {
        this.isSpacePanelOpen = open;
        if (!this.spaceSidePanel) return;

        this.spaceSidePanel.classList.toggle('panel-visible', open);
    }

    private setMapPanelState(open: boolean) {
        this.isMapPanelOpen = open;
        if (!this.mapSidePanel) return;

        this.mapSidePanel.classList.toggle('panel-visible', open);
    }

    private initPanelDragging(panel: HTMLElement | null, handle: HTMLElement | null, panelType: 'map' | 'space') {
        if (!panel || !handle) return;

        let isDragging = false;
        let startX = 0;
        let startOffset = 0;

        const onPointerDown = (event: PointerEvent) => {
            const isPanelOpen = panelType === 'map' ? this.isMapPanelOpen : this.isSpacePanelOpen;
            if (!isPanelOpen) return;

            isDragging = true;
            startX = event.clientX;
            startOffset = panelType === 'map' ? this.mapPanelDragOffset : this.spacePanelDragOffset;
            handle.setPointerCapture(event.pointerId);
            panel.classList.add('panel-dragging');
            event.preventDefault();
        };

        const onPointerMove = (event: PointerEvent) => {
            if (!isDragging) return;
            const deltaX = event.clientX - startX;
            let offset = startOffset + deltaX;
            offset = this.clampOffsetToBounds(panel, offset);

            if (panelType === 'map') {
                this.mapPanelDragOffset = offset;
            } else {
                this.spacePanelDragOffset = offset;
            }

            this.applyPanelOffset(panel, offset);
        };

        const endDrag = (event: PointerEvent) => {
            if (!isDragging) return;
            isDragging = false;
            panel.classList.remove('panel-dragging');
            try {
                handle.releasePointerCapture(event.pointerId);
            } catch {
                // Ignore if capture was not set
            }
        };

        handle.addEventListener('pointerdown', onPointerDown);
        handle.addEventListener('pointermove', onPointerMove);
        handle.addEventListener('pointerup', endDrag);
        handle.addEventListener('pointercancel', endDrag);
        handle.addEventListener('pointerleave', (event) => {
            if (!isDragging) return;
            endDrag(event as PointerEvent);
        });
    }

    private clampPanelOffsetsToBounds() {
        if (this.mapSidePanel) {
            this.mapPanelDragOffset = this.clampOffsetToBounds(this.mapSidePanel, this.mapPanelDragOffset);
            this.applyPanelOffset(this.mapSidePanel, this.mapPanelDragOffset);
        }
        if (this.spaceSidePanel) {
            this.spacePanelDragOffset = this.clampOffsetToBounds(this.spaceSidePanel, this.spacePanelDragOffset);
            this.applyPanelOffset(this.spaceSidePanel, this.spacePanelDragOffset);
        }
    }

    private clampOffsetToBounds(panel: HTMLElement, offset: number): number {
        const minOffset = this.getPanelMinOffset(panel);
        return Math.max(minOffset, Math.min(0, offset));
    }

    private applyPanelOffset(panel: HTMLElement | null, offset: number) {
        if (!panel) return;
        panel.style.setProperty('--drag-offset', `${offset}px`);
    }

    private getPanelMinOffset(panel: HTMLElement): number {
        const width = panel.getBoundingClientRect().width || panel.offsetWidth || 0;
        return Math.min(0, 40 + width - window.innerWidth);
    }

    private setPanelGroupVisibility(element: HTMLElement | null, visible: boolean) {
        if (!element) return;
        element.classList.toggle('panel-hidden', !visible);
    }

    private setButtonState(button: HTMLButtonElement, visible: boolean) {
        if (!button) return;
        button.classList.toggle('button-hidden', !visible);
        button.setAttribute('aria-hidden', visible ? 'false' : 'true');
        button.setAttribute('aria-disabled', visible ? 'false' : 'true');
        button.tabIndex = visible ? 0 : -1;
    }

    private switchToMapView() {
        this.currentView = 'map';
        this.acousticSpace.hide();
        this.marineMap.show();

        // Update button styles
        this.mapViewBtn.style.background = 'rgba(59, 130, 246, 0.8)';
        this.mapViewBtn.style.borderColor = 'rgba(59, 130, 246, 0.9)';
        this.spaceViewBtn.style.background = 'rgba(155, 155, 155, 0.3)';
        this.spaceViewBtn.style.borderColor = 'rgba(155, 155, 155, 0.5)';

        this.updateControlsVisibility();
        this.updateLegend();
        this.updateAutoPilotAvailability();
    }

    private switchToSpaceView() {
        this.currentView = 'space';
        this.marineMap.hide();
        this.acousticSpace.show();

        // Update button styles
        this.spaceViewBtn.style.background = 'rgba(59, 130, 246, 0.8)';
        this.spaceViewBtn.style.borderColor = 'rgba(59, 130, 246, 0.9)';
        this.mapViewBtn.style.background = 'rgba(155, 155, 155, 0.3)';
        this.mapViewBtn.style.borderColor = 'rgba(155, 155, 155, 0.5)';

        this.updateControlsVisibility();
        this.updateAutoPilotAvailability();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new App();
});
