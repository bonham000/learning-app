import glamorous from "glamorous-native";
import React from "react";
import { TextStyle } from "react-native";
import { Text } from "react-native-paper";
import { NavigationScreenProp } from "react-navigation";

import { ScrollContainer } from "@src/components/SharedComponents";
import { ROUTE_NAMES } from "@src/constants/RouteNames";
import { COLORS } from "@src/constants/Theme";
import {
  GlobalStateContextProps,
  withGlobalStateContext,
} from "@src/providers/GlobalStateProvider";
import {
  Lesson,
  LessonScreenParams,
  LessonSummaryType,
  ListScreenParams,
} from "@src/tools/types";
import {
  adjustListContentByDifficultySetting,
  DeriveLessonContentArgs,
  getFinalUnlockedListKey,
  getRandomQuizChallenge,
  getReviewLessonSet,
} from "@src/tools/utils";

/** ========================================================================
 * Types
 * =========================================================================
 */

interface IProps extends GlobalStateContextProps {
  navigation: NavigationScreenProp<{}>;
}

/** ========================================================================
 * React Class
 * =========================================================================
 */

export class HomeScreenComponent extends React.Component<IProps, {}> {
  render(): JSX.Element {
    const totalWords = this.props.lessons.reduce(
      (total, lesson) => total + lesson.content.length,
      0,
    );
    return (
      <ScrollContainer>
        <Text style={TextStyles}>Choose a lesson to start studying</Text>
        <Text style={{ marginTop: 6, marginBottom: 18 }}>
          {totalWords.toLocaleString()} words total
        </Text>
        {this.renderListSets()}
        <LineBreak />
        <Text style={TextStyles}>Practice everyday to gain experience!</Text>
        <ReviewLink onPress={this.openLessonSummarySpecial("DAILY_QUIZ")}>
          <Text style={{ fontWeight: "600" }}>Daily Challenge! 天天桔</Text>
          <Text>🍊</Text>
        </ReviewLink>
        <ReviewLink
          style={{ marginTop: 6 }}
          onPress={this.openLessonSummarySpecial("SUMMARY")}
        >
          <Text style={{ fontWeight: "600" }}>Review All Unlocked Content</Text>
          <Text>🗃</Text>
        </ReviewLink>
      </ScrollContainer>
    );
  }

  renderListSets = () => {
    const { lessons, userScoreStatus } = this.props;
    const unlockedListIndex = getFinalUnlockedListKey(userScoreStatus);
    return lessons.map((hskList, index) => {
      const isLocked = index > unlockedListIndex;
      const inProgress = index === unlockedListIndex;
      const { list, content } = hskList;
      return (
        <LessonBlock
          key={hskList.list}
          style={{
            backgroundColor: isLocked
              ? COLORS.lockedLessonBlock
              : inProgress
              ? COLORS.lessonBlockInProgress
              : COLORS.lessonBlock,
          }}
          onPress={this.handleSelectList(list, content, index, isLocked)}
        >
          <LessonBlockText isLocked={isLocked}>
            HSK Level {list}
          </LessonBlockText>
          <LessonBlockText isLocked={isLocked}>
            ({content.length.toLocaleString()} words)
          </LessonBlockText>
        </LessonBlock>
      );
    });
  };

  handleSelectList = (
    listKey: string,
    hskList: Lesson,
    index: number,
    isLocked: boolean,
  ) => () => {
    if (isLocked) {
      this.props.setToastMessage("Please complete the previous lesson first");
    } else {
      this.openListSummary(listKey, hskList, index)();
    }
  };

  openListSummary = (
    listKey: string,
    list: Lesson,
    listIndex: number,
    type: LessonSummaryType = "LESSON",
  ) => () => {
    const hskList = adjustListContentByDifficultySetting(
      list,
      this.props.appDifficultySetting,
    );
    const params: ListScreenParams = {
      type,
      listKey,
      hskList,
      listIndex,
    };
    this.props.navigation.navigate(ROUTE_NAMES.LIST_SUMMARY, params);
  };

  openLessonSummarySpecial = (type: LessonSummaryType) => () => {
    const { lessons, userScoreStatus, appDifficultySetting } = this.props;
    const unlockedLessonIndex = getFinalUnlockedListKey(userScoreStatus);
    const args: DeriveLessonContentArgs = {
      lists: lessons,
      unlockedListIndex: unlockedLessonIndex,
      appDifficultySetting,
      userScoreStatus,
    };
    const dailyQuizSet = getRandomQuizChallenge(args);
    const reviewSet = getReviewLessonSet(args);
    const lesson = type === "DAILY_QUIZ" ? dailyQuizSet : reviewSet;

    const params: LessonScreenParams = {
      type,
      lesson,
      listIndex: Infinity,
      lessonIndex: Infinity,
      isFinalLesson: false,
      isFinalUnlockedLesson: false,
    };

    this.props.navigation.navigate(ROUTE_NAMES.LESSON_SUMMARY, params);
  };
}

/** ========================================================================
 * Helpers & Styles
 * =========================================================================
 */

const LessonBlock = glamorous.touchableOpacity({
  width: "90%",
  height: 50,
  padding: 12,
  margin: 4,
  borderRadius: 5,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  backgroundColor: "rgb(225,225,225)",
});

const ReviewLink = glamorous.touchableOpacity({
  width: "90%",
  height: 50,
  padding: 12,
  margin: 4,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  backgroundColor: COLORS.actionButtonMint,
});

const TextStyles = {
  fontSize: 16,
  width: "88%",
  fontWeight: "bold",
  textAlign: "center",
  marginBottom: 16,
};

const LineBreak = glamorous.view({
  width: "85%",
  height: 1,
  marginTop: 16,
  marginBottom: 16,
  backgroundColor: COLORS.line,
});

const LessonBlockText = glamorous.text(
  {},
  (props: { isLocked: boolean }) =>
    (props.isLocked
      ? {
          color: COLORS.inactive,
          fontWeight: "500",
          textDecorationStyle: "solid",
        }
      : {
          color: "black",
          fontWeight: "500",
          textDecorationLine: "none",
        }) as TextStyle,
);

/** ========================================================================
 * Export
 * =========================================================================
 */

export default withGlobalStateContext(HomeScreenComponent);
