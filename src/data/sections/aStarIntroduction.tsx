import { type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import { EditableH1, EditableParagraph } from "@/components/atoms";

export const aStarIntroductionBlocks: ReactElement[] = [
    <StackLayout key="layout-introduction-title" maxWidth="xl">
        <Block id="introduction-title" padding="md">
            <EditableH1 id="h1-introduction-title" blockId="introduction-title">
                The A* Algorithm
            </EditableH1>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-introduction-hospital-scenario" maxWidth="xl">
        <Block id="introduction-hospital-scenario" padding="sm">
            <EditableParagraph id="para-introduction-hospital-scenario" blockId="introduction-hospital-scenario">
                A delivery robot is parked somewhere on the fourth floor of a hospital, and a nurse three
                corridors away needs a blood sample. The robot has a map of the building, cut into a grid of
                squares: some are open floor, some are walls. Its job is to find a shortest path, meaning a
                route from where it stands to where it needs to be that crosses as few squares as possible.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-introduction-promise" maxWidth="xl">
        <Block id="introduction-promise" padding="sm">
            <EditableParagraph id="para-introduction-promise" blockId="introduction-promise">
                Finding that route is easy for you, looking at the whole map at once. The robot cannot do that.
                It has to check squares one at a time, and checking costs time. Here we build up the A* algorithm,
                the method that decides which square to check next, and by the end you will be able to say why it
                gets away with checking so many fewer squares than the obvious approach.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
