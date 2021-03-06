import styled from "@emotion/native";
import React from "react";
import { Alert, Dimensions, ScrollView } from "react-native";
import Swiper from "react-native-deck-swiper";
import FlipCard from "react-native-flip-card";
import { NavigationScreenProp } from "react-navigation";

import { NativeStyleThemeProps } from "@src/AppContainer";
import { BasicContainer } from "@src/components/SharedComponents";
import { COLORS } from "@src/constants/Theme";
import {
  GlobalStateContextProps,
  withGlobalStateContext,
} from "@src/providers/GlobalStateProvider";
import { Lesson, LessonScreenParams, Word } from "@src/tools/types";
import { knuthShuffle } from "@src/tools/utils";

/** ========================================================================
 * Types
 * =========================================================================
 */

interface IProps extends GlobalStateContextProps {
  navigation: NavigationScreenProp<{}, LessonScreenParams>;
}

interface IState {
  completed: number;
  lesson: Lesson;
  deck: Lesson;
}

export const { width, height } = Dimensions.get("window");

/** ========================================================================
 * React Class
 * =========================================================================
 */

export class FlashcardsScreenComponent extends React.Component<IProps, IState> {
  swiper: any = null;

  constructor(props: IProps) {
    super(props);

    const lesson = this.props.navigation.getParam("lesson");

    this.state = {
      completed: 0,
      lesson,
      deck: knuthShuffle(lesson),
    };
  }

  render(): JSX.Element {
    return (
      <BasicContainer>
        <Swiper
          infinite
          marginTop={32}
          animateCardOpacity
          verticalSwipe={false}
          cardVerticalMargin={0}
          cardHorizontalMargin={0}
          animateOverlayLabelsOpacity
          cards={this.state.deck}
          renderCard={this.renderCard}
          ref={this.handleAssignSwiperRef}
          backgroundColor={
            this.props.appTheme === "dark"
              ? COLORS.backgroundDark
              : COLORS.lightWhite
          }
          overlayLabels={CARD_OVERLAY_LABELS}
          onSwipedLeft={this.handleSwipe("left")}
          onSwipedRight={this.handleSwipe("right")}
          overlayOpacityVerticalThreshold={1}
          overlayOpacityHorizontalThreshold={1}
        />
        <ProgressText>
          Progress: {this.state.completed} / {this.state.lesson.length}{" "}
          completed
        </ProgressText>
      </BasicContainer>
    );
  }

  renderCard = (card: Word) => {
    return (
      <ScrollView>
        <FlipCard
          style={FlipCardStyles}
          perspective={1000}
          flipHorizontal={true}
          flipVertical={false}
        >
          <FlipSideView>
            <FaceText>{card.traditional}</FaceText>
          </FlipSideView>
          <FlipSideView>
            <BackText>{card.pinyin}</BackText>
            <BackText
              style={{
                fontSize: 30,
                marginTop: 18,
              }}
            >
              "{card.english}"
            </BackText>
          </FlipSideView>
        </FlipCard>
      </ScrollView>
    );
  };

  randomizeDeck = () => {
    this.setState({
      deck: knuthShuffle(this.state.lesson),
    });
  };

  handleSwipe = (direction: "left" | "right") => (cardIndex: number) => {
    const { deck, completed } = this.state;

    let newDeck: Lesson;
    if (direction === "left") {
      if (cardIndex === deck.length - 2) {
        newDeck = [
          ...deck.slice(0, cardIndex + 1),
          deck[cardIndex + 1],
          deck[cardIndex],
        ];
      } else {
        const reshuffledDeckSlice = knuthShuffle([
          ...deck.slice(cardIndex + 1),
          deck[cardIndex],
        ]);

        if (cardIndex === deck.length - 1 && completed > 0) {
          newDeck = reshuffledDeckSlice;
        } else {
          newDeck = [...deck.slice(0, cardIndex + 1), ...reshuffledDeckSlice];
        }
      }
    } else {
      newDeck = deck;
    }

    const inc = direction === "right" ? 1 : 0;
    const finished = completed + inc;

    if (finished === this.state.lesson.length) {
      return this.handleFinish();
    }

    this.setState({
      deck: newDeck,
      completed: finished,
    });
  };

  handleFinish = () => {
    this.setState(
      {
        deck: [],
        completed: 0,
      },
      () => {
        Alert.alert(
          "You finished all the flashcards!!! 🎉",
          "The deck will be shuffled and restarted now.",
          [
            {
              text: "OK!",
              onPress: this.randomizeDeck,
            },
          ],
          { cancelable: false },
        );
      },
    );
  };

  handleAssignSwiperRef = (swiper: any) => {
    // tslint:disable-next-line
    this.swiper = swiper;
  };
}

/** ========================================================================
 * Helpers & Styles
 * =========================================================================
 */

const FlipCardStyles = {
  // backgroundColor: "white",
  alignItems: "center",
  shadowOpacity: 0.5,
  shadowOffset: {
    height: 12,
    width: 12,
  },
  elevation: 12,
  width: width - 20,
  height: height - 200,
  marginTop: 5,
  marginLeft: 10,
  marginRight: 10,
  borderWidth: 0,
};

const FlipSideView = styled.View<any>`
  flex: 1px;
  align-items: center;
  justify-content: center;
  background-color: ${(props: NativeStyleThemeProps) =>
    props.theme.type === "dark"
      ? COLORS.flashcardDarkTheme
      : COLORS.flashcardLightTheme};
`;

const FaceText = styled.Text({
  fontSize: 100,
  textAlign: "center",
  width: width - 40,
  color: COLORS.primaryRed,
});

const BackText = styled.Text({
  fontSize: 40,
  textAlign: "center",
  width: width - 40,
  color: COLORS.primaryBlue,
});

const ProgressText = styled.Text({
  marginTop: 8,
  fontSize: 10,
  textAlign: "center",
});

const CARD_OVERLAY_LABELS = {
  left: {
    title: "Nope!",
    style: {
      label: {
        backgroundColor: "black",
        borderColor: "black",
        color: COLORS.primaryRed,
        borderWidth: 1,
      },
      wrapper: {
        flexDirection: "column",
        alignItems: "flex-end",
        justifyContent: "flex-start",
        marginTop: 30,
        marginLeft: -30,
      },
    },
  },
  right: {
    title: "Got it!",
    style: {
      label: {
        backgroundColor: "black",
        borderColor: "black",
        color: COLORS.actionButtonMint,
        borderWidth: 1,
      },
      wrapper: {
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "flex-start",
        marginTop: 30,
        marginLeft: 30,
      },
    },
  },
};

/** ========================================================================
 * Export
 * =========================================================================
 */

export default withGlobalStateContext(FlashcardsScreenComponent);
