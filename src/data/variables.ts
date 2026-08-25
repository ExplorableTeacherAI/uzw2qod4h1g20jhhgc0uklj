/**
 * Variables Configuration
 * =======================
 * 
 * CENTRAL PLACE TO DEFINE ALL SHARED VARIABLES
 * 
 * This file defines all variables that can be shared across sections.
 * AI agents should read this file to understand what variables are available.
 * 
 * USAGE:
 * 1. Define variables here with their default values and metadata
 * 2. Use them in any section with: const x = useVar('variableName', defaultValue)
 * 3. Update them with: setVar('variableName', newValue)
 */

import { type VarValue } from '@/stores';

/**
 * Variable definition with metadata
 */
export interface VariableDefinition {
    /** Default value */
    defaultValue: VarValue;
    /** Human-readable label */
    label?: string;
    /** Description for AI agents */
    description?: string;
    /** Variable type hint */
    type?: 'number' | 'text' | 'boolean' | 'select' | 'array' | 'object' | 'spotColor' | 'linkedHighlight';
    /** Unit (e.g., 'Hz', '°', 'm/s') - for numbers */
    unit?: string;
    /** Minimum value (for number sliders) */
    min?: number;
    /** Maximum value (for number sliders) */
    max?: number;
    /** Step increment (for number sliders) */
    step?: number;
    /** Display color for InlineScrubbleNumber / InlineSpotColor (e.g. '#D81B60') */
    color?: string;
    /** Options for 'select' type variables */
    options?: string[];
    /** Placeholder text for text inputs */
    placeholder?: string;
    /**
     * Correct answer for cloze input validation.
     * Accepts a single string, pipe-separated alternates (e.g. "first | 1 | 1st"),
     * or an array of accepted answers (e.g. ["first", "1", "1st"]).
     */
    correctAnswer?: string | string[];
    /** Whether cloze matching is case sensitive */
    caseSensitive?: boolean;
    /** Background color for inline components */
    bgColor?: string;
    /** Schema hint for object types (for AI agents) */
    schema?: string;
}

/**
 * =====================================================
 * 🎯 DEFINE YOUR VARIABLES HERE
 * =====================================================
 * 
 * SUPPORTED TYPES:
 * 
 * 1. NUMBER (slider):
 *    { defaultValue: 5, type: 'number', min: 0, max: 10, step: 1 }
 * 
 * 2. TEXT (free text):
 *    { defaultValue: 'Hello', type: 'text', placeholder: 'Enter text...' }
 * 
 * 3. SELECT (dropdown):
 *    { defaultValue: 'sine', type: 'select', options: ['sine', 'cosine', 'tangent'] }
 * 
 * 4. BOOLEAN (toggle):
 *    { defaultValue: true, type: 'boolean' }
 * 
 * 5. ARRAY (list of numbers):
 *    { defaultValue: [1, 2, 3], type: 'array' }
 * 
 * 6. OBJECT (complex data):
 *    { defaultValue: { x: 5, y: 10 }, type: 'object', schema: '{ x: number, y: number }' }
 */
export const variableDefinitions: Record<string, VariableDefinition> = {
    // ─────────────────────────────────────────
    // SECTION — Searching Blind (linked pair: floor map + count graph)
    // ─────────────────────────────────────────
    blindSearchStep: {
        defaultValue: 4,
        type: 'number',
        label: 'Steps out from the robot',
        description: 'How far the blind search has spread from the robot, in steps. Shared by the floor map and the count graph.',
        min: 0,
        max: 17,
        step: 1,
        color: '#62D0AD',
    },

    blindSearchHighlight: {
        defaultValue: '',
        type: 'linkedHighlight',
        label: 'Blind search highlight',
        description: "Which part is highlighted across both views: '' | 'checked' | 'frontier'",
        color: '#62D0AD',
        bgColor: 'rgba(98, 208, 173, 0.22)',
    },

    answer_blind_search_order: {
        defaultValue: '',
        type: 'select',
        label: 'Blind search ordering answer',
        description: 'Student answer: what the blind search orders squares by',
        placeholder: '???',
        correctAnswer: 'the robot',
        options: ['the robot', 'the nurse', 'the nearest wall'],
        color: '#8E90F5',
    },

    // ─────────────────────────────────────────
    // SECTION — A Guess Worth Having (walking by the guess alone)
    // ─────────────────────────────────────────
    guessWalkCol: {
        defaultValue: 2,
        type: 'number',
        label: 'Robot column',
        description: 'Column the robot currently stands on while walking by the guess',
        min: 0,
        max: 12,
        step: 1,
        color: '#62D0AD',
    },

    guessWalkRow: {
        defaultValue: 4,
        type: 'number',
        label: 'Robot row',
        description: 'Row the robot currently stands on while walking by the guess',
        min: 0,
        max: 8,
        step: 1,
        color: '#62D0AD',
    },

    guessWalkSteps: {
        defaultValue: 0,
        type: 'number',
        label: 'Steps walked',
        description: 'How many squares the student has stepped the robot along',
        min: 0,
        max: 60,
        step: 1,
        color: '#62D0AD',
    },

    guessWalkHighlight: {
        defaultValue: '',
        type: 'linkedHighlight',
        label: 'Guess walk highlight',
        description: "Which part of the guess map is highlighted: '' | 'guesses' | 'moves'",
        color: '#62D0AD',
        bgColor: 'rgba(98, 208, 173, 0.22)',
    },

    answer_heuristic_value: {
        defaultValue: '',
        type: 'text',
        label: 'Heuristic value answer',
        description: 'Student answer: the guess for a square three columns and five rows from the nurse',
        placeholder: '???',
        correctAnswer: '8',
        color: '#8E90F5',
    },

    answer_heuristic_trap: {
        defaultValue: '',
        type: 'select',
        label: 'Heuristic trap answer',
        description: 'Student answer: what a small guess says nothing about',
        placeholder: '???',
        correctAnswer: 'the walls in the way',
        options: ['the walls in the way', 'the distance to the nurse', 'the size of the room'],
        color: '#8E90F5',
    },

    // ─────────────────────────────────────────
    // SECTION — Same Path, Less Searching (predict, then watch A* run)
    // ─────────────────────────────────────────
    predictedLength: {
        defaultValue: 10,
        type: 'number',
        label: 'Predicted route length',
        description: "The student's guess at how many steps A*'s route will take",
        min: 1,
        max: 30,
        step: 1,
        color: '#62D0AD',
    },

    comparisonRevealed: {
        defaultValue: false,
        type: 'boolean',
        label: 'A* revealed',
        description: 'Whether the student has committed a prediction and seen A* run',
    },

    comparisonHighlight: {
        defaultValue: '',
        type: 'linkedHighlight',
        label: 'Comparison highlight',
        description: "Which part is highlighted: '' | 'blindChecked' | 'astarChecked' | 'prediction'",
        color: '#62D0AD',
        bgColor: 'rgba(98, 208, 173, 0.22)',
    },

    answer_comparison_length: {
        defaultValue: '',
        type: 'select',
        label: 'Route length comparison answer',
        description: "Student answer: how A*'s route compares in length with the blind search's route",
        placeholder: '???',
        correctAnswer: 'exactly as long as',
        options: ['exactly as long as', 'shorter than', 'longer than'],
        color: '#8E90F5',
    },

    answer_comparison_checked: {
        defaultValue: '',
        type: 'text',
        label: 'A* checked count answer',
        description: 'Student answer: how many squares A* checked on this map',
        placeholder: '???',
        correctAnswer: ['54', '54 squares'],
        color: '#8E90F5',
    },

    answer_blind_search_count: {
        defaultValue: '',
        type: 'text',
        label: 'Blind search checked count answer',
        description: 'Student answer: how many squares the blind search checked before reaching the nurse',
        placeholder: '???',
        correctAnswer: ['92', '92 squares'],
        color: '#8E90F5',
    },


    // Uncomment and modify these examples for your lesson:

    /*
    // ─────────────────────────────────────────
    // NUMBER - Use with sliders
    // ─────────────────────────────────────────
    myValue: {
        defaultValue: 5,
        type: 'number',
        label: 'My Value',
        description: 'A number that controls something',
        unit: 'm',           // optional unit display
        min: 0,
        max: 10,
        step: 0.5,
    },

    // ─────────────────────────────────────────
    // TEXT - Free text input
    // ─────────────────────────────────────────
    lessonTitle: {
        defaultValue: 'My Lesson',
        type: 'text',
        label: 'Lesson Title',
        description: 'The title of your lesson',
        placeholder: 'Enter a title...',
    },

    // ─────────────────────────────────────────
    // SELECT - Dropdown with options
    // ─────────────────────────────────────────
    difficulty: {
        defaultValue: 'medium',
        type: 'select',
        label: 'Difficulty',
        description: 'The difficulty level of the lesson',
        options: ['easy', 'medium', 'hard', 'expert'],
    },

    // ─────────────────────────────────────────
    // BOOLEAN - Toggle switch
    // ─────────────────────────────────────────
    showHints: {
        defaultValue: true,
        type: 'boolean',
        label: 'Show Hints',
        description: 'Toggle to show or hide hints',
    },

    // ─────────────────────────────────────────
    // ARRAY - List of numbers
    // ─────────────────────────────────────────
    dataPoints: {
        defaultValue: [1, 4, 9, 16, 25],
        type: 'array',
        label: 'Data Points',
        description: 'Y-values for plotting a graph',
    },

    // ─────────────────────────────────────────
    // OBJECT - Complex structured data
    // ─────────────────────────────────────────
    graphSettings: {
        defaultValue: { 
            xMin: -10, 
            xMax: 10, 
            showGrid: true 
        },
        type: 'object',
        label: 'Graph Settings',
        description: 'Configuration for the graph display',
        schema: '{ xMin: number, xMax: number, showGrid: boolean }',
    },
    */
};

/**
 * Get all variable names (for AI agents to discover)
 */
export const getVariableNames = (): string[] => {
    return Object.keys(variableDefinitions);
};

/**
 * Get a variable's default value
 */
export const getDefaultValue = (name: string): VarValue => {
    return variableDefinitions[name]?.defaultValue ?? 0;
};

/**
 * Get a variable's metadata
 */
export const getVariableInfo = (name: string): VariableDefinition | undefined => {
    return variableDefinitions[name];
};

/**
 * Get all default values as a record (for initialization)
 */
export const getDefaultValues = (): Record<string, VarValue> => {
    const defaults: Record<string, VarValue> = {};
    for (const [name, def] of Object.entries(variableDefinitions)) {
        defaults[name] = def.defaultValue;
    }
    return defaults;
};

/**
 * Get number props for InlineScrubbleNumber from a variable definition.
 * Use with getVariableInfo(name) in blocks.tsx, or getExampleVariableInfo(name) in exampleBlocks.tsx.
 */
export function numberPropsFromDefinition(def: VariableDefinition | undefined): {
    defaultValue?: number;
    min?: number;
    max?: number;
    step?: number;
    color?: string;
} {
    if (!def || def.type !== 'number') return {};
    return {
        defaultValue: def.defaultValue as number,
        min: def.min,
        max: def.max,
        step: def.step,
        ...(def.color ? { color: def.color } : {}),
    };
}

/**
 * Get cloze input props for InlineClozeInput from a variable definition.
 * Use with getVariableInfo(name) in blocks.tsx, or getExampleVariableInfo(name) in exampleBlocks.tsx.
 */
/**
 * Get cloze choice props for InlineClozeChoice from a variable definition.
 * Use with getVariableInfo(name) in blocks.tsx.
 */
export function choicePropsFromDefinition(def: VariableDefinition | undefined): {
    placeholder?: string;
    color?: string;
    bgColor?: string;
} {
    if (!def || def.type !== 'select') return {};
    return {
        ...(def.placeholder ? { placeholder: def.placeholder } : {}),
        ...(def.color ? { color: def.color } : {}),
        ...(def.bgColor ? { bgColor: def.bgColor } : {}),
    };
}

/**
 * Get toggle props for InlineToggle from a variable definition.
 * Use with getVariableInfo(name) in blocks.tsx.
 */
export function togglePropsFromDefinition(def: VariableDefinition | undefined): {
    color?: string;
    bgColor?: string;
} {
    if (!def || def.type !== 'select') return {};
    return {
        ...(def.color ? { color: def.color } : {}),
        ...(def.bgColor ? { bgColor: def.bgColor } : {}),
    };
}

export function clozePropsFromDefinition(def: VariableDefinition | undefined): {
    placeholder?: string;
    color?: string;
    bgColor?: string;
    caseSensitive?: boolean;
} {
    if (!def || def.type !== 'text') return {};
    return {
        ...(def.placeholder ? { placeholder: def.placeholder } : {}),
        ...(def.color ? { color: def.color } : {}),
        ...(def.bgColor ? { bgColor: def.bgColor } : {}),
        ...(def.caseSensitive !== undefined ? { caseSensitive: def.caseSensitive } : {}),
    };
}

/**
 * Get spot-color props for InlineSpotColor from a variable definition.
 * Extracts the `color` field.
 *
 * @example
 * <InlineSpotColor
 *     varName="radius"
 *     {...spotColorPropsFromDefinition(getVariableInfo('radius'))}
 * >
 *     radius
 * </InlineSpotColor>
 */
export function spotColorPropsFromDefinition(def: VariableDefinition | undefined): {
    color: string;
} {
    return {
        color: def?.color ?? '#8B5CF6',
    };
}

/**
 * Get linked-highlight props for InlineLinkedHighlight from a variable definition.
 * Extracts the `color` and `bgColor` fields.
 *
 * @example
 * <InlineLinkedHighlight
 *     varName="activeHighlight"
 *     highlightId="radius"
 *     {...linkedHighlightPropsFromDefinition(getVariableInfo('activeHighlight'))}
 * >
 *     radius
 * </InlineLinkedHighlight>
 */
export function linkedHighlightPropsFromDefinition(def: VariableDefinition | undefined): {
    color?: string;
    bgColor?: string;
} {
    return {
        ...(def?.color ? { color: def.color } : {}),
        ...(def?.bgColor ? { bgColor: def.bgColor } : {}),
    };
}

/**
 * Build the `variables` prop for FormulaBlock from variable definitions.
 *
 * Takes an array of variable names and returns the config map expected by
 * `<FormulaBlock variables={...} />`.
 *
 * @example
 * import { scrubVarsFromDefinitions } from './variables';
 *
 * <FormulaBlock
 *     latex="\scrub{mass} \times \scrub{accel}"
 *     variables={scrubVarsFromDefinitions(['mass', 'accel'])}
 * />
 */
export function scrubVarsFromDefinitions(
    varNames: string[],
): Record<string, { min?: number; max?: number; step?: number; color?: string }> {
    const result: Record<string, { min?: number; max?: number; step?: number; color?: string }> = {};
    for (const name of varNames) {
        const def = variableDefinitions[name];
        if (!def) continue;
        result[name] = {
            ...(def.min !== undefined ? { min: def.min } : {}),
            ...(def.max !== undefined ? { max: def.max } : {}),
            ...(def.step !== undefined ? { step: def.step } : {}),
            ...(def.color ? { color: def.color } : {}),
        };
    }
    return result;
}
