import { type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import { EditableH2, EditableParagraph } from "@/components/atoms";

export const wrappingUpBlocks: ReactElement[] = [
    <StackLayout key="layout-conclusion-heading" maxWidth="xl">
        <Block id="conclusion-heading" padding="md">
            <EditableH2 id="h2-conclusion-heading" blockId="conclusion-heading">
                Wrapping Up
            </EditableH2>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-conclusion-one-family" maxWidth="xl">
        <Block id="conclusion-one-family" padding="sm">
            <EditableParagraph id="para-conclusion-one-family" blockId="conclusion-one-family">
                The blind search and A* were never really different algorithms. Both work outwards from the
                robot taking the cheapest square next; A* simply adds the guess to the cost, so cheapest comes
                to mean close to the nurse as well as close to home. Drop the guess to zero and A* turns back
                into the blind search, which is exactly what happens on a map where nobody knows which way the
                goal lies.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-conclusion-takeaway" maxWidth="xl">
        <Block id="conclusion-takeaway" padding="sm">
            <EditableParagraph id="para-conclusion-takeaway" blockId="conclusion-takeaway">
                That is why the two searches end with routes of the same length while one of them checks a
                fraction of the room. A* does not find better paths. It finds the same path having wasted less
                time looking, and that is the difference between a game character who moves the instant you
                click and one that stops to think.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
