import { Asset, Updates } from "expo";
import React from "react";
import { Alert, AppState, BackHandler, View } from "react-native";
import { createAppContainer } from "react-navigation";

import ErrorComponent from "@src/components/ErrorComponent";
import {
  LoadingComponent,
  TransparentLoadingComponent,
} from "@src/components/LoadingComponent";
import { CustomToast } from "@src/components/ToastProvider";
import GlobalContext, {
  APP_DIFFICULTY_SETTING,
  APP_LANGUAGE_SETTING,
  LessonScoreType,
  ScoreStatus,
  WordDictionary,
} from "@src/GlobalState";
import createAppNavigator from "@src/NavigatorConfig";
import {
  fetchLessonSet,
  findOrCreateUser,
  updateAppDifficultySetting,
  updateUserExperience,
  updateUserScores,
} from "@src/tools/api";
import {
  getAppLanguageSetting,
  getLocalUser,
  GoogleSigninUser,
  setAppLanguageSetting,
} from "@src/tools/store";
import { HSKListSet } from "@src/tools/types";
import {
  createWordDictionaryFromLessons,
  formatUserLanguageSetting,
} from "@src/tools/utils";
import { GlobalStateValues } from "./components/GlobalStateProvider";

/** ========================================================================
 * Types
 * =========================================================================
 */

interface IState extends GlobalStateValues {
  userId?: string;
  error: boolean;
  loading: boolean;
  appState: string;
  toastMessage: string;
  updating: boolean;
  tryingToCloseApp: boolean;
  transparentLoading: boolean;
}

const defaultScoreState = {
  mc_english: false,
  mc_mandarin: false,
  quiz_text: false,
  mandarin_pronunciation: false,
  final_completed_lesson_index: 0,
};

/** ========================================================================
 * React Class
 * =========================================================================
 */

class RootContainer extends React.Component<{}, IState> {
  timeout: any = null;
  navigationRef: any = null;

  constructor(props: {}) {
    super(props);

    this.state = {
      error: false,
      lessons: [],
      experience: 0,
      loading: true,
      toastMessage: "",
      updating: false,
      wordDictionary: {},
      tryingToCloseApp: false,
      transparentLoading: false,
      appState: AppState.currentState,
      userScoreStatus: defaultScoreState,
      appDifficultySetting: APP_DIFFICULTY_SETTING.MEDIUM,
      languageSetting: APP_LANGUAGE_SETTING.SIMPLIFIED,
    };
  }

  async componentDidMount(): Promise<void> {
    this.getInitialScoreState();

    /**
     * Manage state to assign a toast warning if user tries to
     * press the back button when it will close the app. Show them
     * a toast and allow them to press again to close the app.
     */
    BackHandler.addEventListener("hardwareBackPress", () => {
      if (this.canCloseApp()) {
        if (!this.state.tryingToCloseApp) {
          this.setState(
            {
              tryingToCloseApp: true,
            },
            () => this.setToastMessage("Press again to close app"),
          );
          return true;
        } else {
          return this.setState(
            {
              tryingToCloseApp: false,
            },
            BackHandler.exitApp,
          );
        }
      }

      return false;
    });

    /**
     * Add listener to AppState to detect app foreground/background actions.
     */
    AppState.addEventListener("change", this.handleAppStateChange);

    /**
     * Check for updates when app is first opened.
     */
    this.checkForAppUpdate();
  }

  componentWillUnmount(): void {
    /**
     * Remove listeners and clear any existing timeout.
     */
    BackHandler.removeEventListener("hardwareBackPress", () => {
      return;
    });

    AppState.removeEventListener("change", this.handleAppStateChange);

    this.clearTimer();
  }

  render(): JSX.Element | null {
    const {
      user,
      error,
      loading,
      lessons,
      updating,
      experience,
      wordDictionary,
      languageSetting,
      userScoreStatus,
      transparentLoading,
      appDifficultySetting,
    } = this.state;
    if (error) {
      return <ErrorComponent />;
    } else if (updating || loading) {
      return <LoadingComponent />;
    }

    const authenticatedUser = user as GoogleSigninUser;
    const lessonSet = lessons as HSKListSet;

    return (
      <View style={{ flex: 1 }}>
        {transparentLoading && <TransparentLoadingComponent />}
        <CustomToast
          close={this.clearToast}
          message={this.state.toastMessage}
        />
        <GlobalContext.Provider
          value={{
            experience,
            wordDictionary,
            languageSetting,
            userScoreStatus,
            lessons: lessonSet,
            appDifficultySetting,
            user: authenticatedUser,
            onSignin: this.handleSignin,
            setLessonScore: this.setLessonScore,
            setToastMessage: this.setToastMessage,
            handleResetScores: this.handleResetScores,
            handleSwitchLanguage: this.handleSwitchLanguage,
            handleUpdateAppDifficultySetting: this
              .handleUpdateAppDifficultySetting,
          }}
        >
          <AppPureComponent
            userLoggedIn={Boolean(this.state.user)}
            assignNavigatorRef={this.assignNavRef}
          />
        </GlobalContext.Provider>
      </View>
    );
  }

  getInitialScoreState = async () => {
    /**
     * Fetch image assets
     */
    await Asset.fromModule(
      require("@src/assets/google_icon.png"),
    ).downloadAsync();

    /**
     * Fetch lessons
     */
    const lessons = await fetchLessonSet();

    if (!lessons) {
      this.setState({
        error: true,
      });
    } else {
      const wordDictionary = createWordDictionaryFromLessons(lessons);
      this.setState(
        {
          lessons,
          wordDictionary,
          languageSetting: await getAppLanguageSetting(),
        },
        this.setupUserSession,
      );
    }
  };

  setupUserSession = async () => {
    const localUser = await getLocalUser();

    if (localUser && localUser.email) {
      const user = await findOrCreateUser(localUser.email);

      if (user) {
        const scoreHistory = JSON.parse(user.score_history);
        this.setState({
          loading: false,
          transparentLoading: false,
          user: localUser,
          userId: user.uuid,
          experience: user.experience_points,
          userScoreStatus: scoreHistory,
          appDifficultySetting: user.app_difficulty_setting,
        });
      }
    }
    /**
     * No local user found. Disable loading which will render the
     * signin screen.
     */
    this.setState({ loading: false });
  };

  handleSignin = async (user: GoogleSigninUser) => {
    if (user && user.email) {
      const userResult = await findOrCreateUser(user.email);
      if (userResult) {
        this.setState({ user, userId: userResult.uuid });
      }
    } else {
      // TODO: Handle missing email...
      console.log("User found with no email...");
    }
  };

  setLessonScore = async (
    lessonIndex: number,
    lessonPassedType: LessonScoreType,
    exp: number,
  ) => {
    const { userId } = this.state;

    if (userId) {
      const updatedScoreStatus: ScoreStatus = {
        ...this.state.userScoreStatus,
        [lessonPassedType]: true,
      };

      await updateUserScores(userId, updatedScoreStatus);
      const updatedUser = await updateUserExperience(userId, exp);

      if (updatedUser) {
        const { experience_points, score_history } = updatedUser;

        this.setState({
          experience: experience_points,
          userScoreStatus: JSON.parse(score_history),
        });
      }
    }
  };

  assignNavRef = (ref: any) => {
    // tslint:disable-next-line
    this.navigationRef = ref;
  };

  clearTimer = () => {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
  };

  abortTryingToClose = () => {
    this.setState({ tryingToCloseApp: false });
  };

  setToastMessage = (toastMessage: string): void => {
    this.clearTimer();
    this.setState(
      {
        toastMessage,
      },
      () => {
        // tslint:disable-next-line
        this.timeout = setTimeout(() => {
          this.clearToast();
          this.abortTryingToClose();
        }, 2000);
      },
    );
  };

  clearToast = () => {
    this.setState({
      toastMessage: "",
    });
  };

  handleSwitchLanguage = (callback: () => void) => {
    const { languageSetting } = this.state;
    const alternate =
      languageSetting === APP_LANGUAGE_SETTING.SIMPLIFIED
        ? APP_LANGUAGE_SETTING.TRADITIONAL
        : APP_LANGUAGE_SETTING.SIMPLIFIED;

    Alert.alert(
      `Your current setting is ${formatUserLanguageSetting(
        this.state.languageSetting,
      )}`,
      `Do you want to switch to ${formatUserLanguageSetting(
        alternate,
      )}? You can switch back at anytime.`,
      [
        {
          text: "Cancel",
          onPress: () => null,
          style: "cancel",
        },
        {
          text: "OK",
          onPress: () => this.switchLanguage(callback),
        },
      ],
      { cancelable: false },
    );
  };

  switchLanguage = (callback: () => void) => {
    switch (this.state.languageSetting) {
      case APP_LANGUAGE_SETTING.SIMPLIFIED:
        return this.setState(
          {
            languageSetting: APP_LANGUAGE_SETTING.TRADITIONAL,
          },
          async () => {
            callback();
            this.handleSetLanguageSuccess(APP_LANGUAGE_SETTING.TRADITIONAL);
          },
        );
      case APP_LANGUAGE_SETTING.TRADITIONAL:
        return this.setState(
          {
            languageSetting: APP_LANGUAGE_SETTING.SIMPLIFIED,
          },
          async () => {
            callback();
            this.handleSetLanguageSuccess(APP_LANGUAGE_SETTING.SIMPLIFIED);
          },
        );
      default:
        console.log(
          `Unknown language setting received: ${this.state.languageSetting}`,
        );
        return this.setState(
          {
            languageSetting: APP_LANGUAGE_SETTING.SIMPLIFIED,
          },
          async () => {
            callback();
            this.handleSetLanguageSuccess(APP_LANGUAGE_SETTING.SIMPLIFIED);
          },
        );
    }
  };

  handleSetLanguageSuccess = (languageSetting: APP_LANGUAGE_SETTING) => {
    setAppLanguageSetting(languageSetting);
    this.setState({
      toastMessage: `Language set to ${formatUserLanguageSetting(
        languageSetting,
      )}`,
    });
  };

  handleUpdateAppDifficultySetting = async (
    appDifficultySetting: APP_DIFFICULTY_SETTING,
  ) => {
    const { userId } = this.state;
    if (userId) {
      this.setState(
        {
          transparentLoading: true,
        },
        async () => {
          const result = await updateAppDifficultySetting(
            userId,
            appDifficultySetting,
          );
          if (result) {
            this.setState({
              appDifficultySetting,
              transparentLoading: false,
              toastMessage: "App difficulty updated",
            });
          } else {
            this.setState({
              transparentLoading: false,
              toastMessage: "Update failed, please try again...",
            });
          }
        },
      );
    }
  };

  handleResetScores = () => {
    Alert.alert(
      "Are you sure?",
      "All existing progress will be erased! This is irreversible 🤯",
      [
        {
          text: "Cancel",
          onPress: () => null,
          style: "cancel",
        },
        {
          text: "OK",
          onPress: this.resetScores,
        },
      ],
      { cancelable: false },
    );
  };

  resetScores = () => {
    this.setState(
      {
        transparentLoading: true,
      },
      () => {
        // tslint:disable-next-line
        this.timeout = setTimeout(async () => {
          const { userId } = this.state;
          if (userId) {
            await updateUserScores(userId, defaultScoreState);
            await updateUserExperience(userId, 0);
          }
          this.setState({ toastMessage: "Scores reset!" });
          this.getInitialScoreState();
        }, 1250);
      },
    );
  };

  canCloseApp = () => {
    try {
      return this.navigationRef.state.nav.routes[0].routes.length === 1;
    } catch (_) {
      return true;
    }
  };

  handleAppStateChange = (nextAppState: string) => {
    if (
      this.state.appState.match(/inactive|background/) &&
      nextAppState === "active"
    ) {
      this.checkForAppUpdate();
    }

    this.setState({ appState: nextAppState });
  };

  checkForAppUpdate = async (): Promise<void> => {
    try {
      const { isAvailable } = await Updates.checkForUpdateAsync();
      if (isAvailable) {
        Alert.alert(
          "Update Available!",
          "Confirm to update now",
          [
            { text: "Cancel", onPress: () => null, style: "cancel" },
            { text: "OK", onPress: this.updateApp },
          ],
          { cancelable: false },
        );
      }
    } catch (err) {
      return;
    }
  };

  updateApp = () => {
    try {
      this.setState(
        {
          updating: true,
        },
        async () => {
          await Updates.fetchUpdateAsync();
          Updates.reloadFromCache();
        },
      );
    } catch (err) {
      this.setState({
        updating: false,
        toastMessage: "Update failed...",
      });
    }
  };
}

/** ========================================================================
 * App Component
 * =========================================================================
 */

// tslint:disable-next-line
class AppPureComponent extends React.Component<
  { assignNavigatorRef: (ref: any) => void; userLoggedIn: boolean },
  {}
> {
  shouldComponentUpdate(_: any): boolean {
    return false;
  }

  render(): JSX.Element {
    const AppNavigator = createAppNavigator(this.props.userLoggedIn);
    const Nav = createAppContainer(AppNavigator);
    return <Nav ref={this.props.assignNavigatorRef} />;
  }
}

/** ========================================================================
 * Export
 * =========================================================================
 */

export default RootContainer;
